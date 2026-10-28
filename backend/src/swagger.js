const customerProps = {
  name: { type: 'string', example: 'Jane Doe' },
  email: { type: 'string', example: 'jane@example.com' },
  phone: { type: 'string', example: '+1-555-0100' },
  address: { type: 'string', example: '1 Main St, Springfield' },
};
const idParam = { name: 'id', in: 'path', required: true, schema: { type: 'integer' } };
const ref = { $ref: '#/components/schemas/Customer' };
const json = (schema) => ({ 'application/json': { schema } });
const body = (required) => ({
  required: true,
  content: json({ type: 'object', required, properties: customerProps }),
});
const notFound = { description: 'Customer not found' };

export default {
  openapi: '3.0.3',
  info: { title: 'Customer API', version: '1.0.0', description: 'CRUD for customers plus an AI agent endpoint.' },
  tags: [{ name: 'Customers' }, { name: 'Agent' }],
  components: {
    schemas: {
      Customer: {
        type: 'object',
        properties: { id: { type: 'integer', example: 1 }, ...customerProps, created_at: { type: 'string', format: 'date-time' } },
      },
    },
  },
  paths: {
    '/customers': {
      get: {
        tags: ['Customers'], summary: 'List customers (optional name filter)',
        parameters: [{ name: 'name', in: 'query', schema: { type: 'string' } }],
        responses: { 200: { description: 'OK', content: json({ type: 'array', items: ref }) } },
      },
      post: {
        tags: ['Customers'], summary: 'Create a customer', requestBody: body(['name']),
        responses: { 201: { description: 'Created', content: json(ref) }, 400: { description: 'Invalid input' } },
      },
    },
    '/customers/{id}': {
      get: { tags: ['Customers'], summary: 'Get a customer', parameters: [idParam], responses: { 200: { description: 'OK', content: json(ref) }, 404: notFound } },
      put: { tags: ['Customers'], summary: 'Update a customer', parameters: [idParam], requestBody: body([]), responses: { 200: { description: 'OK', content: json(ref) }, 404: notFound } },
      delete: { tags: ['Customers'], summary: 'Delete a customer', parameters: [idParam], responses: { 200: { description: 'Deleted' }, 404: notFound } },
    },
    '/agent': {
      post: {
        tags: ['Agent'], summary: 'Ask a natural-language question about customers',
        description: 'Claude uses tools (list, find by name, add, update, delete) against the database.',
        requestBody: {
          required: true,
          content: json({
            type: 'object', required: ['message'],
            properties: {
              message: { type: 'string', example: 'Get all customers' },
              history: { type: 'array', description: 'Optional prior messages', items: { type: 'object' } },
            },
          }),
        },
        responses: { 200: { description: 'Agent reply with tool calls made' }, 503: { description: 'API key not configured' } },
      },
    },
  },
};
