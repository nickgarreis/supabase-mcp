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
          // ... (keeping all existing tool definitions)
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
          // ... (all other existing tool definitions remain the same)
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
          // ... (all other existing tool implementations remain the same)
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
      case 'read_records':
        return `Read records from table '${args.table}'${args.filter ? ` with filter: ${JSON.stringify(args.filter)}` : ''}`;
      // ... (add descriptions for other tools)
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
