#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { SupabaseQueryResult, SupabaseFilterBuilder, AdminAuthOperations } from './types/supabase.js';

// Ensure environment variables are defined
const SUPABASE_URL = process.env.SUPABASE_URL ?? '';
const SUPABASE_KEY = process.env.SUPABASE_KEY ?? '';
const SUPABASE_ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN ?? '';

if (!SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error('SUPABASE_URL and SUPABASE_KEY environment variables are required');
}

if (!SUPABASE_ACCESS_TOKEN) {
  throw new Error('SUPABASE_ACCESS_TOKEN environment variable is required for management operations');
}

// Management API base URL
const MANAGEMENT_API_URL = 'https://api.supabase.com/v1';

class SupabaseServer {
  private server: Server;
  private supabase: SupabaseClient;
  private auth: { admin: AdminAuthOperations };

  constructor() {
    this.server = new Server(
      {
        name: 'supabase-server',
        version: '0.1.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    this.auth = this.supabase.auth as any;

    this.setupToolHandlers();
    
    this.server.onerror = (error) => console.error('[MCP Error]', error);
    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  private setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'create_record',
          description: 'Create a new record in a Supabase table',
          inputSchema: {
            type: 'object',
            properties: {
              table: {
                type: 'string',
                description: 'Table name',
              },
              data: {
                type: 'object',
                description: 'Record data',
              },
              returning: {
                type: 'array',
                items: { type: 'string' },
                description: 'Fields to return (optional)',
              },
            },
            required: ['table', 'data'],
          },
        },
        {
          name: 'read_records',
          description: 'Read records from a Supabase table',
          inputSchema: {
            type: 'object',
            properties: {
              table: {
                type: 'string',
                description: 'Table name',
              },
              select: {
                type: 'array',
                items: { type: 'string' },
                description: 'Fields to select (optional)',
              },
              filter: {
                type: 'object',
                description: 'Filter conditions (optional)',
              },
            },
            required: ['table'],
          },
        },
        {
          name: 'update_record',
          description: 'Update records in a Supabase table',
          inputSchema: {
            type: 'object',
            properties: {
              table: {
                type: 'string',
                description: 'Table name',
              },
              data: {
                type: 'object',
                description: 'Update data',
              },
              filter: {
                type: 'object',
                description: 'Filter conditions',
              },
              returning: {
                type: 'array',
                items: { type: 'string' },
                description: 'Fields to return (optional)',
              },
            },
            required: ['table', 'data'],
          },
        },
        {
          name: 'delete_record',
          description: 'Delete records from a Supabase table',
          inputSchema: {
            type: 'object',
            properties: {
              table: {
                type: 'string',
                description: 'Table name',
              },
              filter: {
                type: 'object',
                description: 'Filter conditions',
              },
              returning: {
                type: 'array',
                items: { type: 'string' },
                description: 'Fields to return (optional)',
              },
            },
            required: ['table'],
          },
        },
        {
          name: 'upload_file',
          description: 'Upload a file to Supabase Storage',
          inputSchema: {
            type: 'object',
            properties: {
              bucket: {
                type: 'string',
                description: 'Storage bucket name',
              },
              path: {
                type: 'string',
                description: 'File path in bucket',
              },
              file: {
                type: 'object',
                description: 'File to upload',
              },
              options: {
                type: 'object',
                properties: {
                  cacheControl: { type: 'string' },
                  contentType: { type: 'string' },
                  upsert: { type: 'boolean' },
                },
                description: 'Upload options (optional)',
              },
            },
            required: ['bucket', 'path', 'file'],
          },
        },
        {
          name: 'download_file',
          description: 'Download a file from Supabase Storage',
          inputSchema: {
            type: 'object',
            properties: {
              bucket: {
                type: 'string',
                description: 'Storage bucket name',
              },
              path: {
                type: 'string',
                description: 'File path in bucket',
              },
            },
            required: ['bucket', 'path'],
          },
        },
        {
          name: 'invoke_function',
          description: 'Invoke a Supabase Edge Function',
          inputSchema: {
            type: 'object',
            properties: {
              function: {
                type: 'string',
                description: 'Function name',
              },
              params: {
                type: 'object',
                description: 'Function parameters (optional)',
              },
              options: {
                type: 'object',
                properties: {
                  headers: { type: 'object' },
                  responseType: { 
                    type: 'string',
                    enum: ['json', 'text', 'arraybuffer'],
                  },
                },
                description: 'Invocation options (optional)',
              },
            },
            required: ['function'],
          },
        },
        {
          name: 'list_projects',
          description: 'List all Supabase projects',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
        {
          name: 'get_project',
          description: 'Get details of a specific Supabase project',
          inputSchema: {
            type: 'object',
            properties: {
              project_id: {
                type: 'string',
                description: 'Project ID',
              },
            },
            required: ['project_id'],
          },
        },
        {
          name: 'create_project',
          description: 'Create a new Supabase project',
          inputSchema: {
            type: 'object',
            properties: {
              name: {
                type: 'string',
                description: 'Project name',
              },
              organization_id: {
                type: 'string',
                description: 'Organization ID',
              },
              region: {
                type: 'string',
                description: 'Project region',
              },
              db_pass: {
                type: 'string',
                description: 'Database password',
              },
              plan: {
                type: 'string',
                description: 'Project plan (optional)',
                enum: ['free', 'pro', 'team', 'enterprise'],
              },
            },
            required: ['name', 'organization_id', 'region', 'db_pass'],
          },
        },
        {
          name: 'delete_project',
          description: 'Delete a Supabase project',
          inputSchema: {
            type: 'object',
            properties: {
              project_id: {
                type: 'string',
                description: 'Project ID',
              },
            },
            required: ['project_id'],
          },
        },
        {
          name: 'list_organizations',
          description: 'List all organizations',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
        {
          name: 'get_organization',
          description: 'Get details of a specific organization',
          inputSchema: {
            type: 'object',
            properties: {
              organization_id: {
                type: 'string',
                description: 'Organization ID',
              },
            },
            required: ['organization_id'],
          },
        },
        {
          name: 'create_organization',
          description: 'Create a new organization',
          inputSchema: {
            type: 'object',
            properties: {
              name: {
                type: 'string',
                description: 'Organization name',
              },
            },
            required: ['name'],
          },
        },
        {
          name: 'get_project_api_keys',
          description: 'Get API keys for a specific Supabase project',
          inputSchema: {
            type: 'object',
            properties: {
              project_id: {
                type: 'string',
                description: 'Project ID',
              },
            },
            required: ['project_id'],
          },
        },
        {
          name: 'list_users',
          description: 'List all users in a project',
          inputSchema: {
            type: 'object',
            properties: {
              page: {
                type: 'number',
                description: 'Page number (optional)',
              },
              per_page: {
                type: 'number',
                description: 'Items per page (optional)',
              },
            },
          },
        },
        {
          name: 'get_user',
          description: 'Get details of a specific user',
          inputSchema: {
            type: 'object',
            properties: {
              user_id: {
                type: 'string',
                description: 'User ID',
              },
            },
            required: ['user_id'],
          },
        },
        {
          name: 'create_user',
          description: 'Create a new user',
          inputSchema: {
            type: 'object',
            properties: {
              email: {
                type: 'string',
                description: 'User email',
              },
              password: {
                type: 'string',
                description: 'User password',
              },
              data: {
                type: 'object',
                description: 'Additional user data (optional)',
              },
            },
            required: ['email', 'password'],
          },
        },
        {
          name: 'update_user',
          description: 'Update a user',
          inputSchema: {
            type: 'object',
            properties: {
              user_id: {
                type: 'string',
                description: 'User ID',
              },
              email: {
                type: 'string',
                description: 'New email (optional)',
              },
              password: {
                type: 'string',
                description: 'New password (optional)',
              },
              data: {
                type: 'object',
                description: 'Additional user data to update (optional)',
              },
            },
            required: ['user_id'],
          },
        },
        {
          name: 'delete_user',
          description: 'Delete a user',
          inputSchema: {
            type: 'object',
            properties: {
              user_id: {
                type: 'string',
                description: 'User ID',
              },
            },
            required: ['user_id'],
          },
        },
        {
          name: 'assign_user_role',
          description: 'Assign a role to a user',
          inputSchema: {
            type: 'object',
            properties: {
              user_id: {
                type: 'string',
                description: 'User ID',
              },
              role: {
                type: 'string',
                description: 'Role name',
              },
            },
            required: ['user_id', 'role'],
          },
        },
        {
          name: 'remove_user_role',
          description: 'Remove a role from a user',
          inputSchema: {
            type: 'object',
            properties: {
              user_id: {
                type: 'string',
                description: 'User ID',
              },
              role: {
                type: 'string',
                description: 'Role name',
              },
            },
            required: ['user_id', 'role'],
          },
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      try {
        const { name, arguments: args } = request.params;
        const typedArgs = args as Record<string, unknown>;

        switch (name) {
          case 'create_record': {
            if (!typedArgs.table || !typedArgs.data) {
              throw new McpError(ErrorCode.InvalidParams, 'Missing required parameters: table, data');
            }

            const { data, error } = await this.supabase
              .from(typedArgs.table as string)
              .insert(typedArgs.data as Record<string, unknown>)
              .select((typedArgs.returning as string[])?.join(',') || '*');

            if (error) throw error;
            return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
          }

          case 'read_records': {
            if (!typedArgs.table) {
              throw new McpError(ErrorCode.InvalidParams, 'Missing required parameter: table');
            }

            let query = this.supabase
              .from(typedArgs.table as string)
              .select((typedArgs.select as string[])?.join(',') || '*') as SupabaseFilterBuilder<any>;

            if (typedArgs.filter) {
              const filter = typedArgs.filter as Record<string, unknown>;
              for (const [key, value] of Object.entries(filter)) {
                if (typeof value === 'object' && value !== null) {
                  const conditions = value as Record<string, unknown>;
                  Object.entries(conditions).forEach(([op, val]) => {
                    query = query.filter(key, op, val) as SupabaseFilterBuilder<any>;
                  });
                } else {
                  query = query.eq(key, value) as SupabaseFilterBuilder<any>;
                }
              }
            }

            const { data, error } = await query;
            if (error) throw error;
            return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
          }

          case 'update_record': {
            if (!typedArgs.table || !typedArgs.data) {
              throw new McpError(ErrorCode.InvalidParams, 'Missing required parameters: table, data');
            }

            let query = this.supabase
              .from(typedArgs.table as string)
              .update(typedArgs.data as Record<string, unknown>) as SupabaseFilterBuilder<any>;

            if (typedArgs.filter) {
              const filter = typedArgs.filter as Record<string, unknown>;
              for (const [key, value] of Object.entries(filter)) {
                query = query.eq(key, value) as SupabaseFilterBuilder<any>;
              }
            }

            if (typedArgs.returning) {
              query = query.select((typedArgs.returning as string[]).join(',')) as SupabaseFilterBuilder<any>;
            }

            const { data, error } = await query;
            if (error) throw error;
            return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
          }

          case 'delete_record': {
            if (!typedArgs.table) {
              throw new McpError(ErrorCode.InvalidParams, 'Missing required parameter: table');
            }

            let query = this.supabase
              .from(typedArgs.table as string)
              .delete() as SupabaseFilterBuilder<any>;

            if (typedArgs.filter) {
              const filter = typedArgs.filter as Record<string, unknown>;
              for (const [key, value] of Object.entries(filter)) {
                query = query.eq(key, value) as SupabaseFilterBuilder<any>;
              }
            }

            if (typedArgs.returning) {
              query = query.select((typedArgs.returning as string[]).join(',')) as SupabaseFilterBuilder<any>;
            }

            const { data, error } = await query;
            if (error) throw error;
            return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
          }

          case 'upload_file': {
            if (!typedArgs.bucket || !typedArgs.path || !typedArgs.file) {
              throw new McpError(ErrorCode.InvalidParams, 'Missing required parameters: bucket, path, file');
            }

            const { data, error } = await this.supabase.storage
              .from(typedArgs.bucket as string)
              .upload(
                typedArgs.path as string,
                typedArgs.file as File | Blob,
                typedArgs.options as { cacheControl?: string; contentType?: string; upsert?: boolean }
              );

            if (error) throw error;
            return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
          }

          case 'download_file': {
            if (!typedArgs.bucket || !typedArgs.path) {
              throw new McpError(ErrorCode.InvalidParams, 'Missing required parameters: bucket, path');
            }

            const { data, error } = await this.supabase.storage
              .from(typedArgs.bucket as string)
              .download(typedArgs.path as string);

            if (error) throw error;
            return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
          }

          case 'invoke_function': {
            if (!typedArgs.function) {
              throw new McpError(ErrorCode.InvalidParams, 'Missing required parameter: function');
            }

            const { data, error } = await this.supabase.functions.invoke(
              typedArgs.function as string,
              {
                body: typedArgs.params as Record<string, unknown>,
                ...(typedArgs.options as { headers?: Record<string, string>; responseType?: 'json' | 'text' | 'arraybuffer' }),
              }
            );

            if (error) throw error;
            return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
          }

          case 'list_projects': {
            const response = await fetch(`${MANAGEMENT_API_URL}/projects`, {
              headers: {
                'Authorization': `Bearer ${SUPABASE_ACCESS_TOKEN}`,
              },
            });
            
            if (!response.ok) {
              throw new Error(`Failed to list projects: ${response.statusText}`);
            }
            
            const data = await response.json();
            return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
          }

          case 'get_project': {
            if (!typedArgs.project_id) {
              throw new McpError(ErrorCode.InvalidParams, 'Missing required parameter: project_id');
            }

            const response = await fetch(`${MANAGEMENT_API_URL}/projects/${typedArgs.project_id}`, {
              headers: {
                'Authorization': `Bearer ${SUPABASE_ACCESS_TOKEN}`,
              },
            });
            
            if (!response.ok) {
              throw new Error(`Failed to get project: ${response.statusText}`);
            }
            
            const data = await response.json();
            return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
          }

          case 'create_project': {
            if (!typedArgs.name || !typedArgs.organization_id || !typedArgs.region || !typedArgs.db_pass) {
              throw new McpError(ErrorCode.InvalidParams, 'Missing required parameters: name, organization_id, region, db_pass');
            }

            const response = await fetch(`${MANAGEMENT_API_URL}/projects`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${SUPABASE_ACCESS_TOKEN}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                name: typedArgs.name,
                organization_id: typedArgs.organization_id,
                region: typedArgs.region,
                db_pass: typedArgs.db_pass,
                plan: typedArgs.plan || 'free',
              }),
            });
            
            if (!response.ok) {
              throw new Error(`Failed to create project: ${response.statusText}`);
            }
            
            const data = await response.json();
            return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
          }

          case 'delete_project': {
            if (!typedArgs.project_id) {
              throw new McpError(ErrorCode.InvalidParams, 'Missing required parameter: project_id');
            }

            const response = await fetch(`${MANAGEMENT_API_URL}/projects/${typedArgs.project_id}`, {
              method: 'DELETE',
              headers: {
                'Authorization': `Bearer ${SUPABASE_ACCESS_TOKEN}`,
              },
            });
            
            if (!response.ok) {
              throw new Error(`Failed to delete project: ${response.statusText}`);
            }
            
            return { content: [{ type: 'text', text: 'Project deleted successfully' }] };
          }

          case 'list_organizations': {
            const response = await fetch(`${MANAGEMENT_API_URL}/organizations`, {
              headers: {
                'Authorization': `Bearer ${SUPABASE_ACCESS_TOKEN}`,
              },
            });
            
            if (!response.ok) {
              throw new Error(`Failed to list organizations: ${response.statusText}`);
            }
            
            const data = await response.json();
            return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
          }

          case 'get_organization': {
            if (!typedArgs.organization_id) {
              throw new McpError(ErrorCode.InvalidParams, 'Missing required parameter: organization_id');
            }

            const response = await fetch(`${MANAGEMENT_API_URL}/organizations/${typedArgs.organization_id}`, {
              headers: {
                'Authorization': `Bearer ${SUPABASE_ACCESS_TOKEN}`,
              },
            });
            
            if (!response.ok) {
              throw new Error(`Failed to get organization: ${response.statusText}`);
            }
            
            const data = await response.json();
            return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
          }

          case 'create_organization': {
            if (!typedArgs.name) {
              throw new McpError(ErrorCode.InvalidParams, 'Missing required parameter: name');
            }

            const response = await fetch(`${MANAGEMENT_API_URL}/organizations`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${SUPABASE_ACCESS_TOKEN}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                name: typedArgs.name,
              }),
            });
            
            if (!response.ok) {
              throw new Error(`Failed to create organization: ${response.statusText}`);
            }
            
            const data = await response.json();
            return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
          }

          case 'get_project_api_keys': {
            if (!typedArgs.project_id) {
              throw new McpError(ErrorCode.InvalidParams, 'Missing required parameter: project_id');
            }

            const response = await fetch(`${MANAGEMENT_API_URL}/projects/${typedArgs.project_id}/api-keys`, {
              headers: {
                'Authorization': `Bearer ${SUPABASE_ACCESS_TOKEN}`,
              },
            });
            
            if (!response.ok) {
              throw new Error(`Failed to get project API keys: ${response.statusText}`);
            }
            
            const data = await response.json();
            return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
          }

          case 'list_users': {
            const page = (typedArgs.page as number) || 1;
            const perPage = (typedArgs.per_page as number) || 50;

            const { data, error } = await this.auth.admin.listUsers({
              page,
              perPage,
            });

            if (error) throw error;
            return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
          }

          case 'get_user': {
            if (!typedArgs.user_id) {
              throw new McpError(ErrorCode.InvalidParams, 'Missing required parameter: user_id');
            }

            const { data, error } = await this.auth.admin.getUserById(
              typedArgs.user_id as string
            );

            if (error) throw error;
            return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
          }

          case 'create_user': {
            if (!typedArgs.email || !typedArgs.password) {
              throw new McpError(ErrorCode.InvalidParams, 'Missing required parameters: email, password');
            }

            const { data, error } = await this.auth.admin.createUser({
              email: typedArgs.email as string,
              password: typedArgs.password as string,
              user_metadata: typedArgs.data as Record<string, unknown>,
              email_confirm: true,
            });

            if (error) throw error;
            return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
          }

          case 'update_user': {
            if (!typedArgs.user_id) {
              throw new McpError(ErrorCode.InvalidParams, 'Missing required parameter: user_id');
            }

            const { data, error } = await this.auth.admin.updateUserById(
              typedArgs.user_id as string,
              {
                email: typedArgs.email as string,
                password: typedArgs.password as string,
                user_metadata: typedArgs.data as Record<string, unknown>,
              }
            );

            if (error) throw error;
            return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
          }

          case 'delete_user': {
            if (!typedArgs.user_id) {
              throw new McpError(ErrorCode.InvalidParams, 'Missing required parameter: user_id');
            }

            const { error } = await this.auth.admin.deleteUser(
              typedArgs.user_id as string
            );

            if (error) throw error;
            return { content: [{ type: 'text', text: 'User deleted successfully' }] };
          }

          case 'assign_user_role': {
            if (!typedArgs.user_id || !typedArgs.role) {
              throw new McpError(ErrorCode.InvalidParams, 'Missing required parameters: user_id, role');
            }

            const { error } = await this.auth.admin.assignUserRole(
              typedArgs.user_id as string,
              typedArgs.role as string
            );

            if (error) throw error;
            return { content: [{ type: 'text', text: 'Role assigned successfully' }] };
          }

          case 'remove_user_role': {
            if (!typedArgs.user_id || !typedArgs.role) {
              throw new McpError(ErrorCode.InvalidParams, 'Missing required parameters: user_id, role');
            }

            const { error } = await this.auth.admin.removeUserRole(
              typedArgs.user_id as string,
              typedArgs.role as string
            );

            if (error) throw error;
            return { content: [{ type: 'text', text: 'Role removed successfully' }] };
          }

          default:
            throw new McpError(
              ErrorCode.MethodNotFound,
              `Unknown tool: ${name}`
            );
        }
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        console.error('[Tool Error]', error);
        return {
          content: [{ type: 'text', text: `Error: ${errorMessage}` }],
          isError: true,
        };
      }
    });
  }

  public async run(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Supabase MCP server running on stdio');
  }
}

const server = new SupabaseServer();
server.run().catch(console.error);
