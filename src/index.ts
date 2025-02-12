#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import express, { Request, Response } from 'express';
import cors from 'cors';
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

interface ToolResponse {
  content: { type: string; text: string }[];
  isError?: boolean;
}

class SupabaseServer {
  private server: Server;
  private supabase: SupabaseClient;
  private auth: { admin: AdminAuthOperations };
  private toolApprovalCallbacks: Map<string, (approved: boolean) => void>;
  private toolRefreshCallbacks: Set<() => void>;

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

    this.toolApprovalCallbacks = new Map();
    this.toolRefreshCallbacks = new Set();

    this.setupToolHandlers();
    
    this.server.onerror = (error) => console.error('[MCP Error]', error);
    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  private setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      // Notify tool refresh listeners
      this.toolRefreshCallbacks.forEach(callback => callback());
      
      return {
        tools: [
          {
            name: 'list_tables',
            description: 'List all tables in the database',
            inputSchema: {
              type: 'object',
              properties: {
                schema: {
                  type: 'string',
                  description: 'Schema name (optional, defaults to public)',
                },
              },
            },
          },
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
                filter: {
                  type: 'object',
                  description: 'Filter conditions (optional)',
                },
                select: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Fields to select (optional)',
                },
                joins: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      type: {
                        type: 'string',
                        enum: ['inner', 'left', 'right', 'full'],
                        description: 'Join type',
                      },
                      table: {
                        type: 'string',
                        description: 'Table to join with',
                      },
                      on: {
                        type: 'string',
                        description: 'Join condition (e.g., "posts.user_id=users.id")',
                      },
                    },
                    required: ['table', 'on'],
                  },
                  description: 'Table joins (optional)',
                },
                limit: {
                  type: 'number',
                  description: 'Maximum number of records to return (optional)',
                },
              },
              required: ['table'],
            },
          },
          {
            name: 'update_records',
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
              required: ['table', 'data', 'filter'],
            },
          },
          {
            name: 'delete_records',
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
              required: ['table', 'filter'],
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
                  description: 'File path within the bucket',
                },
                file: {
                  type: 'object',
                  description: 'File data as base64 string',
                },
                options: {
                  type: 'object',
                  properties: {
                    cacheControl: {
                      type: 'string',
                      description: 'Cache control header',
                    },
                    contentType: {
                      type: 'string',
                      description: 'Content type of the file',
                    },
                    upsert: {
                      type: 'boolean',
                      description: 'Whether to overwrite existing file',
                    },
                  },
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
                  description: 'File path within the bucket',
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
                  description: 'Function parameters',
                },
                options: {
                  type: 'object',
                  properties: {
                    headers: {
                      type: 'object',
                      description: 'Custom headers',
                    },
                    responseType: {
                      type: 'string',
                      enum: ['json', 'text', 'arraybuffer'],
                      description: 'Response type',
                    },
                  },
                },
              },
              required: ['function'],
            },
          },
          {
            name: 'list_users',
            description: 'List users with pagination',
            inputSchema: {
              type: 'object',
              properties: {
                page: {
                  type: 'number',
                  description: 'Page number',
                },
                per_page: {
                  type: 'number',
                  description: 'Items per page',
                },
              },
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
                  description: 'Additional user metadata',
                },
              },
              required: ['email', 'password'],
            },
          },
          {
            name: 'update_user',
            description: 'Update user details',
            inputSchema: {
              type: 'object',
              properties: {
                user_id: {
                  type: 'string',
                  description: 'User ID',
                },
                email: {
                  type: 'string',
                  description: 'New email',
                },
                password: {
                  type: 'string',
                  description: 'New password',
                },
                data: {
                  type: 'object',
                  description: 'Updated user metadata',
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
          }
        ],
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      try {
        const { name, arguments: args } = request.params;
        const typedArgs = args as Record<string, unknown>;

        // Create a promise that resolves when the tool is approved/denied
        const approved = await new Promise<boolean>((resolve) => {
          const requestId = Math.random().toString(36).substring(7);
          this.toolApprovalCallbacks.set(requestId, resolve);
          
          // Format tool call for display
          console.log(JSON.stringify({
            type: 'tool_call',
            requestId,
            tool: name,
            arguments: args,
            description: this.getToolDescription(name, typedArgs)
          }));
        });

        if (!approved) {
          throw new McpError(
            ErrorCode.InvalidRequest,
            'Tool call was denied by user'
          );
        }

        // Execute the tool call (keeping all existing tool implementations)
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
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(data, null, 2),
                },
              ],
            };
          }
          case 'list_tables': {
            const schema = (typedArgs.schema as string) || 'public';
            const { data, error } = await this.supabase
              .rpc('list_tables', { p_schema: schema })
              .select();

            if (error) {
              // If RPC fails (likely because function doesn't exist), fall back to direct query
              const { data: fallbackData, error: fallbackError } = await this.supabase
                .from('information_schema.tables')
                .select('table_name')
                .eq('table_schema', schema)
                .eq('table_type', 'BASE TABLE');

              if (fallbackError) throw fallbackError;
              return {
                content: [
                  {
                    type: 'text',
                    text: JSON.stringify(fallbackData?.map(row => row.table_name) || [], null, 2),
                  },
                ],
              };
            }

            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(data || [], null, 2),
                },
              ],
            };
          }
          case 'read_records': {
            if (!typedArgs.table) {
              throw new McpError(ErrorCode.InvalidParams, 'Missing required parameter: table');
            }

            let query = this.supabase
              .from(typedArgs.table as string) as SupabaseFilterBuilder<any>;

            // Apply filters before select to ensure proper typing
            if (typedArgs.filter) {
              Object.entries(typedArgs.filter as Record<string, unknown>).forEach(([key, value]) => {
                query = query.eq(key, value);
              });
            }

            // Apply joins if specified
            if (typedArgs.joins) {
              (typedArgs.joins as Array<{ type?: string; table: string; on: string }>).forEach((join) => {
                const joinType = join.type || 'left';
                switch (joinType) {
                  case 'inner':
                    query = query.innerJoin(join.table, join.on);
                    break;
                  case 'left':
                    query = query.leftJoin(join.table, join.on);
                    break;
                  case 'right':
                    query = query.rightJoin(join.table, join.on);
                    break;
                  case 'full':
                    query = query.fullOuterJoin(join.table, join.on);
                    break;
                }
              });
            }

            // Now apply select and limit
            const filteredQuery = query.select((typedArgs.select as string[])?.join(',') || '*');

            const finalQuery = typedArgs.limit
              ? filteredQuery.limit(typedArgs.limit as number)
              : filteredQuery;

            const { data, error } = await finalQuery;
            if (error) throw error;

            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(data, null, 2),
                },
              ],
            };
          }
          case 'update_records': {
            if (!typedArgs.table || !typedArgs.data || !typedArgs.filter) {
              throw new McpError(ErrorCode.InvalidParams, 'Missing required parameters: table, data, filter');
            }

            let query = this.supabase
              .from(typedArgs.table as string) as SupabaseFilterBuilder<any>;

            // Apply filters first
            Object.entries(typedArgs.filter as Record<string, unknown>).forEach(([key, value]) => {
              query = query.eq(key, value);
            });

            // Then update
            const updateQuery = query.update(typedArgs.data as Record<string, unknown>);

            const finalQuery = typedArgs.returning
              ? updateQuery.select((typedArgs.returning as string[]).join(','))
              : updateQuery;

            const { data, error } = await finalQuery;
            if (error) throw error;

            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(data, null, 2),
                },
              ],
            };
          }
          case 'delete_records': {
            if (!typedArgs.table || !typedArgs.filter) {
              throw new McpError(ErrorCode.InvalidParams, 'Missing required parameters: table, filter');
            }

            let query = this.supabase
              .from(typedArgs.table as string) as SupabaseFilterBuilder<any>;

            // Apply filters first
            Object.entries(typedArgs.filter as Record<string, unknown>).forEach(([key, value]) => {
              query = query.eq(key, value);
            });

            // Then delete
            const deleteQuery = query.delete();
            
            const finalQuery = typedArgs.returning
              ? deleteQuery.select((typedArgs.returning as string[]).join(','))
              : deleteQuery;

            const { data, error } = await finalQuery;
            if (error) throw error;

            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(data, null, 2),
                },
              ],
            };
          }
          case 'upload_file': {
            if (!typedArgs.bucket || !typedArgs.path || !typedArgs.file) {
              throw new McpError(ErrorCode.InvalidParams, 'Missing required parameters: bucket, path, file');
            }

            // Convert base64 string to Blob for upload
            const fileData = typedArgs.file as { type: string; data: string };
            const byteCharacters = atob(fileData.data);
            const byteArrays = [];
            for (let offset = 0; offset < byteCharacters.length; offset += 512) {
              const slice = byteCharacters.slice(offset, offset + 512);
              const byteNumbers = new Array(slice.length);
              for (let i = 0; i < slice.length; i++) {
                byteNumbers[i] = slice.charCodeAt(i);
              }
              const byteArray = new Uint8Array(byteNumbers);
              byteArrays.push(byteArray);
            }
            const blob = new Blob(byteArrays, { type: fileData.type });

            const { data, error } = await this.supabase.storage
              .from(typedArgs.bucket as string)
              .upload(
                typedArgs.path as string,
                blob,
                typedArgs.options as { cacheControl?: string; contentType?: string; upsert?: boolean }
              );

            if (error) throw error;
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(data, null, 2),
                },
              ],
            };
          }
          case 'download_file': {
            if (!typedArgs.bucket || !typedArgs.path) {
              throw new McpError(ErrorCode.InvalidParams, 'Missing required parameters: bucket, path');
            }

            const { data, error } = await this.supabase.storage
              .from(typedArgs.bucket as string)
              .download(typedArgs.path as string);

            if (error) throw error;
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(data, null, 2),
                },
              ],
            };
          }
          case 'invoke_function': {
            if (!typedArgs.function) {
              throw new McpError(ErrorCode.InvalidParams, 'Missing required parameter: function');
            }

            const { data, error } = await this.supabase.functions
              .invoke(
                typedArgs.function as string,
                {
                  body: typedArgs.params as Record<string, unknown>,
                  headers: (typedArgs.options as any)?.headers,
                }
              );

            if (error) throw error;
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(data, null, 2),
                },
              ],
            };
          }
          case 'list_users': {
            const { data, error } = await this.auth.admin.listUsers({
              page: typedArgs.page as number,
              perPage: typedArgs.per_page as number,
            });

            if (error) throw error;
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(data, null, 2),
                },
              ],
            };
          }
          case 'create_user': {
            if (!typedArgs.email || !typedArgs.password) {
              throw new McpError(ErrorCode.InvalidParams, 'Missing required parameters: email, password');
            }

            const { data, error } = await this.auth.admin.createUser({
              email: typedArgs.email as string,
              password: typedArgs.password as string,
              user_metadata: typedArgs.data as Record<string, unknown>,
            });

            if (error) throw error;
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(data, null, 2),
                },
              ],
            };
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
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(data, null, 2),
                },
              ],
            };
          }
          case 'delete_user': {
            if (!typedArgs.user_id) {
              throw new McpError(ErrorCode.InvalidParams, 'Missing required parameter: user_id');
            }

            const { error } = await this.auth.admin.deleteUser(typedArgs.user_id as string);
            if (error) throw error;

            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({ success: true }, null, 2),
                },
              ],
            };
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

            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({ success: true }, null, 2),
                },
              ],
            };
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

            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({ success: true }, null, 2),
                },
              ],
            };
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
          content: [
            {
              type: 'text',
              text: `Error: ${errorMessage}`,
            },
          ],
          isError: true,
        };
      }
    });
  }

  // Helper method to format tool descriptions for approval display
  private getToolDescription(name: string, args: Record<string, unknown>): string {
    switch (name) {
      case 'create_record':
        return `Create record in table '${args.table}' with data: ${JSON.stringify(args.data)}`;
      case 'list_tables':
        return `List tables in schema '${args.schema || 'public'}'`;
      case 'read_records':
        return `Read records from table '${args.table}'${args.filter ? ` with filter: ${JSON.stringify(args.filter)}` : ''}${args.joins ? ` with joins: ${JSON.stringify(args.joins)}` : ''}`;
      case 'update_records':
        return `Update records in table '${args.table}' with data: ${JSON.stringify(args.data)} and filter: ${JSON.stringify(args.filter)}`;
      case 'delete_records':
        return `Delete records from table '${args.table}' with filter: ${JSON.stringify(args.filter)}`;
      case 'upload_file':
        return `Upload file to bucket '${args.bucket}' at path '${args.path}'`;
      case 'download_file':
        return `Download file from bucket '${args.bucket}' at path '${args.path}'`;
      case 'invoke_function':
        return `Invoke function '${args.function}'${args.params ? ` with params: ${JSON.stringify(args.params)}` : ''}`;
      case 'list_users':
        return `List users${args.page ? ` (page ${args.page}, ${args.per_page} per page)` : ''}`;
      case 'create_user':
        return `Create user with email '${args.email}'`;
      case 'update_user':
        return `Update user '${args.user_id}'`;
      case 'delete_user':
        return `Delete user '${args.user_id}'`;
      case 'assign_user_role':
        return `Assign role '${args.role}' to user '${args.user_id}'`;
      case 'remove_user_role':
        return `Remove role '${args.role}' from user '${args.user_id}'`;
      default:
        return `Execute ${name} with arguments: ${JSON.stringify(args)}`;
    }
  }

  // Method to handle tool approval/denial
  public handleToolApproval(requestId: string, approved: boolean) {
    const callback = this.toolApprovalCallbacks.get(requestId);
    if (callback) {
      callback(approved);
      this.toolApprovalCallbacks.delete(requestId);
    }
  }

  // Method to register tool refresh callback
  public onToolRefresh(callback: () => void) {
    this.toolRefreshCallbacks.add(callback);
    return () => {
      this.toolRefreshCallbacks.delete(callback);
    };
  }

  public async run(transport: 'stdio' | 'sse' = 'stdio', port?: number): Promise<void> {
    if (transport === 'sse') {
      const app = express();
      app.use(cors());
      
      // Create a promise that resolves when SSE connection is established
      const sseConnectionPromise = new Promise<SSEServerTransport>((resolve, reject) => {
        let timeoutId: NodeJS.Timeout;

        // Set a timeout for SSE connection
        timeoutId = setTimeout(() => {
          reject(new Error('SSE connection timeout after 30 seconds'));
        }, 30000);

        app.get('/sse', async (req: Request, res: Response) => {
          res.setHeader('Content-Type', 'text/event-stream');
          res.setHeader('Cache-Control', 'no-cache');
          res.setHeader('Connection', 'keep-alive');

          try {
            const transport = new SSEServerTransport('/message', res);
            await transport.start();
            clearTimeout(timeoutId);
            resolve(transport);
          } catch (error) {
            clearTimeout(timeoutId);
            reject(error);
          }
        });
      });

      // Handle incoming messages
      app.post('/message', async (req: Request, res: Response) => {
        try {
          const transport = await sseConnectionPromise;
          await transport.handlePostMessage(req, res);
        } catch (error) {
          res.status(500).json({ error: 'Failed to handle message' });
        }
      });

      // Start HTTP server and wait for SSE connection
      const httpServer = app.listen(port || 8765, () => {
        console.error(`Supabase MCP server running on SSE at port ${port || 8765}`);
      });

      try {
        const transport = await sseConnectionPromise;
        await this.server.connect(transport);
      } catch (error) {
        httpServer.close();
        throw error;
      }
    } else {
      const transport = new StdioServerTransport();
      await this.server.connect(transport);
      console.error('Supabase MCP server running on stdio');
    }
  }
}

// Create wrapper script for environment variables
const createWrapperScript = () => {
  const scriptContent = `#!/bin/bash
export SUPABASE_URL="\${SUPABASE_URL:-your_supabase_url_here}"
export SUPABASE_KEY="\${SUPABASE_KEY:-your_supabase_key_here}"
export SUPABASE_ACCESS_TOKEN="\${SUPABASE_ACCESS_TOKEN:-your_access_token_here}"
node "${process.argv[1]}" "$@"
`;
  
  const fs = require('fs');
  const path = require('path');
  const wrapperPath = path.join(process.cwd(), 'run-supabase-server.sh');
  
  fs.writeFileSync(wrapperPath, scriptContent);
  fs.chmodSync(wrapperPath, '755');
  
  console.log(`Created wrapper script at ${wrapperPath}`);
};

// Parse command line arguments
const args = process.argv.slice(2);
if (args.includes('--create-wrapper')) {
  createWrapperScript();
} else {
  const transportType = args[0] || 'stdio';
  const port = args[1] ? parseInt(args[1]) : undefined;
  
  const server = new SupabaseServer();
  server.run(transportType as 'stdio' | 'sse', port).catch(console.error);
}
