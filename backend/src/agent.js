import Anthropic from '@anthropic-ai/sdk';
import * as db from './customers.js';
import * as deals from './deals.js';
import { STAGES, validateDeal } from './deals.js';

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5';

const dealProps = {
  title: { type: 'string' },
  amount: { type: 'number', description: 'Amount in Saudi riyals (SAR)' },
  stage: { type: 'string', enum: STAGES },
  expected_close_date: { type: 'string', description: 'YYYY-MM-DD' },
};

const tools = [
  {
    name: 'get_all_customers',
    description: 'Return every customer in the database.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'get_customer_by_name',
    description: 'Find customers whose name contains the given text (case-insensitive).',
    input_schema: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] },
  },
  {
    name: 'get_customer_by_id',
    description: 'Get one customer by numeric id.',
    input_schema: { type: 'object', properties: { id: { type: 'integer' } }, required: ['id'] },
  },
  {
    name: 'add_customer',
    description: 'Create a new customer.',
    input_schema: {
      type: 'object',
      properties: {
        name: { type: 'string' }, email: { type: 'string' },
        phone: { type: 'string' }, address: { type: 'string' },
      },
      required: ['name'],
    },
  },
  {
    name: 'update_customer',
    description: 'Update fields of an existing customer by id.',
    input_schema: {
      type: 'object',
      properties: {
        id: { type: 'integer' }, name: { type: 'string' }, email: { type: 'string' },
        phone: { type: 'string' }, address: { type: 'string' },
      },
      required: ['id'],
    },
  },
  {
    name: 'delete_customer',
    description: 'Delete a customer by id.',
    input_schema: { type: 'object', properties: { id: { type: 'integer' } }, required: ['id'] },
  },
  {
    name: 'list_deals',
    description: 'List deals (sales opportunities), newest first, optionally for one customer and/or one stage.',
    input_schema: {
      type: 'object',
      properties: { customer_id: { type: 'integer' }, stage: { type: 'string', enum: dealProps.stage.enum } },
    },
  },
  {
    name: 'create_deal',
    description: 'Create a deal for one of the customers. Amount is in Saudi riyals (SAR); stage defaults to lead.',
    input_schema: { type: 'object', properties: { customer_id: { type: 'integer' }, ...dealProps }, required: ['customer_id', 'title'] },
  },
  {
    name: 'update_deal',
    description: 'Update a deal by id, e.g. move it to another stage. Send expected_close_date null to clear it.',
    input_schema: { type: 'object', properties: { id: { type: 'integer' }, ...dealProps }, required: ['id'] },
  },
  {
    name: 'delete_deal',
    description: 'Delete a deal by id.',
    input_schema: { type: 'object', properties: { id: { type: 'integer' } }, required: ['id'] },
  },
];

// Handlers are bound to the authenticated user; the model never supplies a user id.
const makeHandlers = (userId) => ({
  get_all_customers: () => db.listCustomers(userId),
  get_customer_by_name: ({ name }) => db.searchByName(userId, name),
  get_customer_by_id: async ({ id }) => (await db.getCustomer(userId, id)) ?? { error: 'Customer not found' },
  add_customer: (a) => db.createCustomer(userId, a),
  update_customer: async ({ id, ...rest }) => (await db.updateCustomer(userId, id, rest)) ?? { error: 'Customer not found' },
  delete_customer: async ({ id }) => (await db.deleteCustomer(userId, id)) ?? { error: 'Customer not found' },
  list_deals: ({ customer_id, stage }) => deals.listDeals(userId, { stage: stage ?? null, customerId: customer_id ?? null }),
  create_deal: async ({ customer_id, ...rest }) => {
    const { value, error } = validateDeal(rest);
    if (error) return { error };
    return (await deals.createDeal(userId, customer_id, value)) ?? { error: 'Customer not found' };
  },
  update_deal: async ({ id, ...rest }) => {
    const { value, error } = validateDeal(rest, { partial: true });
    if (error) return { error };
    return (await deals.updateDeal(userId, id, value)) ?? { error: 'Deal not found' };
  },
  delete_deal: async ({ id }) => ((await deals.deleteDeal(userId, id)) ? { deleted: id } : { error: 'Deal not found' }),
});

const SYSTEM = `You are a customer-management assistant. Use the provided tools to read and modify
customer data in the database; never invent data. You can only see and change the customers
assigned to the logged-in user; treat any other customer as nonexistent. You also manage deals
(sales opportunities with a customer): amounts are in Saudi riyals (SAR) and the stages are lead, qualified,
proposal, won, lost. Be concise and format lists clearly.`;

export async function runAgent(message, history = [], userId) {
  if (!process.env.ANTHROPIC_API_KEY) {
    const err = new Error('ANTHROPIC_API_KEY is not set on the server');
    err.status = 503;
    throw err;
  }
  const handlers = makeHandlers(userId);
  const client = new Anthropic();
  const messages = [...history, { role: 'user', content: message }];
  const toolCalls = [];

  for (let i = 0; i < 8; i++) {
    const res = await client.messages.create({
      model: MODEL, max_tokens: 2048, system: SYSTEM, tools, messages,
    });
    messages.push({ role: 'assistant', content: res.content });
    if (res.stop_reason !== 'tool_use') {
      const reply = res.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n');
      return { reply, toolCalls };
    }
    const results = [];
    for (const block of res.content.filter((b) => b.type === 'tool_use')) {
      let out, isError = false;
      try { out = await handlers[block.name](block.input); }
      catch (e) { out = { error: e.message }; isError = true; }
      toolCalls.push({ name: block.name, input: block.input });
      results.push({ type: 'tool_result', tool_use_id: block.id, content: JSON.stringify(out), is_error: isError });
    }
    messages.push({ role: 'user', content: results });
  }
  return { reply: 'Stopped: too many tool steps.', toolCalls };
}
