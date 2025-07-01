FROM node:18-alpine

# install the Supabase MCP server CLI
RUN npm install -g @supabase/mcp-server-supabase@latest

# expose the HTTP port
EXPOSE 3000

# run in HTTP mode, reading env-vars for project & token
ENTRYPOINT ["mcp-server-supabase","http","--project-ref","${SUPABASE_REF}","--access-token","${SUPABASE_ACCESS_TOKEN}","--port","3000"]

