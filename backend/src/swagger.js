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
const notFound = { description: 'Customer not found, or it belongs to another user' };
const unauthorized = { description: 'Missing, invalid or expired token' };
const forbidden = { description: 'Wrong role for this endpoint (customers and agent are sales-only; /admin is admin-only)' };
const secured =[{ bearerAuth: [] }];
const userRef = { $ref: '#/components/schemas/User' };
const credentials = (required, extra = {}) => ({
  required: true,
  content: json({
    type: 'object', required,
    properties: {
      ...extra,
      email: { type: 'string', example: 'sam@example.com' },
      password: { type: 'string', format: 'password', example: 'secret123' },
    },
  }),
});

const dealInputProps = {
  title: { type: 'string', maxLength: 200, example: 'Brochure printing – Q4' },
  amount: { type: 'number', minimum: 0, example: 150000, description: 'In Saudi riyals (SAR), at most 2 decimals' },
  stage: { type: 'string', enum: ['lead', 'qualified', 'proposal', 'won', 'lost'], default: 'lead' },
  expected_close_date: { type: 'string', format: 'date', nullable: true, example: '2026-11-30', description: 'On update, null clears it' },
};
const dealBody = (required) => ({
  required: true,
  content: json({ type: 'object', required, properties: dealInputProps }),
});
const dealRef = { $ref: '#/components/schemas/Deal' };
const dealNotFound = { description: 'Deal (or its customer) not found, or it belongs to another user' };
const dealInvalid = { description: 'Invalid input' };

export default {
  openapi: '3.0.3',
  info: { title: 'Customer API', version: '1.0.0', description: 'Registration and login, plus per-user customer CRUD and an AI agent. Customers are only visible to the sales user that owns them: register, log in, then use the Authorize button with the returned token. Roles: sales (default) and admin; the admin logs in at /auth/admin/login and sees the users dashboard at /admin/users.' },
  tags: [{ name: 'Auth' }, { name: 'Admin' }, { name: 'Customers' }, { name: 'Deals' }, { name: 'Agent' }],
  components: {
    securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } },
    schemas: {
      User: {
        type: 'object',
        properties: {
          id: { type: 'integer', example: 1 }, name: { type: 'string', example: 'Sam Sales' },
          email: { type: 'string', example: 'sam@example.com' },
          role: { type: 'string', example: 'sales', description: "Always 'sales' for new registrations" },
          created_at: { type: 'string', format: 'date-time' },
        },
      },
      AdminUserSummary: {
        type: 'object',
        properties: {
          id: { type: 'integer', example: 2 }, name: { type: 'string', example: 'Sam Sales' },
          email: { type: 'string', example: 'sam@example.com' },
          role: { type: 'string', enum: ['sales', 'admin'] },
          created_at: { type: 'string', format: 'date-time' },
          customer_count: { type: 'integer', example: 5, description: 'Customers owned by this user (0 if none)' },
        },
      },
      AuthResponse: {
        type: 'object',
        properties: { token: { type: 'string', description: 'JWT to send as "Authorization: Bearer <token>"' }, user: userRef },
      },
      Customer: {
        type: 'object',
        properties: { id: { type: 'integer', example: 1 }, ...customerProps, sales_user_id: { type: 'integer', example: 1, description: 'Owning sales user (set from the token)' }, created_at: { type: 'string', format: 'date-time' } },
      },
      Deal: {
        type: 'object',
        properties: {
          id: { type: 'integer', example: 1 }, customer_id: { type: 'integer', example: 1 },
          sales_user_id: { type: 'integer', example: 1, description: 'Owning sales user (set from the token)' },
          ...dealInputProps,
          customer_name: { type: 'string', description: 'Only in GET /deals' },
          created_at: { type: 'string', format: 'date-time' }, updated_at: { type: 'string', format: 'date-time' },
        },
      },
    },
  },
  paths: {
    '/auth/register': {
      post: {
        tags: ['Auth'], summary: 'Register a new user (role: sales)',
        requestBody: credentials(['name', 'email', 'password'], { name: { type: 'string', example: 'Sam Sales' } }),
        responses: {
          201: { description: 'Created', content: json(userRef) },
          400: { description: 'Missing name, malformed email or password under 8 characters' },
          409: { description: 'Email already registered' },
        },
      },
    },
    '/auth/login': {
      post: {
        tags: ['Auth'], summary: 'Log in and get a token', requestBody: credentials(['email', 'password']),
        responses: {
          200: { description: 'OK', content: json({ $ref: '#/components/schemas/AuthResponse' }) },
          401: { description: 'Invalid email or password' },
        },
      },
    },
    '/auth/admin/login': {
      post: {
        tags: ['Auth'], summary: 'Admin login (sales accounts are rejected)', requestBody: credentials(['email', 'password']),
        responses: {
          200: { description: 'OK', content: json({ $ref: '#/components/schemas/AuthResponse' }) },
          401: { description: 'Invalid email or password' },
        },
      },
    },
    '/admin/users': {
      get: {
        tags: ['Admin'], summary: 'List all users with their customer counts', security: secured,
        responses: { 401: unauthorized, 403: forbidden, 200: { description: 'OK', content: json({ type: 'array', items: { $ref: '#/components/schemas/AdminUserSummary' } }) } },
      },
    },
    '/auth/me': {
      get: {
        tags: ['Auth'], summary: 'Current user', security: secured,
        responses: { 401: unauthorized, 200: { description: 'OK', content: json(userRef) } },
      },
    },
    '/customers': {
      get: {
        tags: ['Customers'], summary: 'List customers (optional name filter)', security: secured,
        parameters: [{ name: 'name', in: 'query', schema: { type: 'string' } }],
        responses: { 401: unauthorized, 403: forbidden, 200: { description: 'OK', content: json({ type: 'array', items: ref }) } },
      },
      post: {
        tags: ['Customers'], summary: 'Create a customer', security: secured, requestBody: body(['name']),
        responses: { 401: unauthorized, 403: forbidden, 201: { description: 'Created', content: json(ref) }, 400: { description: 'Invalid input' } },
      },
    },
    '/customers/export': {
      get: {
        tags: ['Customers'], summary: 'Export your customers to an Excel (.xlsx) file', security: secured,
        description: 'Only customers owned by the logged-in user. Optional q filters by name, email, phone or address (case-insensitive substring).',
        parameters: [{ name: 'q', in: 'query', schema: { type: 'string' } }],
        responses: {
          401: unauthorized, 403: forbidden,
          200: {
            description: 'The .xlsx file (header row only if there are no matching customers)',
            content: { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': { schema: { type: 'string', format: 'binary' } } },
          },
        },
      },
    },
    '/customers/{id}': {
      get: { tags: ['Customers'], summary: 'Get a customer', security: secured, parameters: [idParam], responses: { 401: unauthorized, 403: forbidden, 200: { description: 'OK', content: json(ref) }, 404: notFound } },
      put: { tags: ['Customers'], summary: 'Update a customer', security: secured, parameters: [idParam], requestBody: body([]), responses: { 401: unauthorized, 403: forbidden, 200: { description: 'OK', content: json(ref) }, 404: notFound } },
      delete: { tags: ['Customers'], summary: 'Delete a customer', security: secured, parameters: [idParam], responses: { 401: unauthorized, 403: forbidden, 200: { description: 'Deleted' }, 404: notFound } },
    },
    '/customers/{id}/deals': {
      get: { tags: ['Deals'], summary: 'List the deals of one of your customers (newest first)', security: secured, parameters: [idParam], responses: { 401: unauthorized, 403: forbidden, 200: { description: 'OK', content: json({ type: 'array', items: dealRef }) }, 404: notFound } },
      post: { tags: ['Deals'], summary: 'Create a deal for one of your customers', security: secured, parameters: [idParam], requestBody: dealBody(['title']), responses: { 401: unauthorized, 403: forbidden, 201: { description: 'Created', content: json(dealRef) }, 400: dealInvalid, 404: notFound } },
    },
    '/deals': {
      get: {
        tags: ['Deals'], summary: 'List all your deals across customers (newest first)', security: secured,
        parameters: [
          { name: 'stage', in: 'query', schema: { type: 'string', enum: ['lead', 'qualified', 'proposal', 'won', 'lost'] } },
          { name: 'customer_id', in: 'query', schema: { type: 'integer' } },
        ],
        responses: { 401: unauthorized, 403: forbidden, 400: { description: 'Invalid stage or customer_id' }, 200: { description: 'OK', content: json({ type: 'array', items: dealRef }) } },
      },
    },
    '/deals/{id}': {
      get: { tags: ['Deals'], summary: 'Get a deal', security: secured, parameters: [idParam], responses: { 401: unauthorized, 403: forbidden, 200: { description: 'OK', content: json(dealRef) }, 404: dealNotFound } },
      put: { tags: ['Deals'], summary: 'Update a deal (omitted fields are kept)', security: secured, parameters: [idParam], requestBody: dealBody([]), responses: { 401: unauthorized, 403: forbidden, 200: { description: 'OK', content: json(dealRef) }, 400: dealInvalid, 404: dealNotFound } },
      delete: { tags: ['Deals'], summary: 'Delete a deal', security: secured, parameters: [idParam], responses: { 401: unauthorized, 403: forbidden, 204: { description: 'Deleted' }, 404: dealNotFound } },
    },
    '/agent': {
      post: {
        tags: ['Agent'], summary: 'Ask a natural-language question about customers', security: secured,
        description: 'Claude uses tools (list, find by name, add, update, delete) against the database, limited to the logged-in user customers.',
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
        responses: { 401: unauthorized, 403: forbidden, 200: { description: 'Agent reply with tool calls made' }, 503: { description: 'API key not configured' } },
      },
    },
  },
};
