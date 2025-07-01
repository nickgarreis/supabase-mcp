FROM node:18-alpine

# install the Supabase MCP server CLI
RUN npm install -g @supabase/mcp-server-supabase@latest

# copy only config.json if you’re using one (optional)
# COPY config.json /app/config.json

# tell the MCP server to run in HTTP mode, pick up env vars for project & token
CMD [
  "mcp-server-supabase",
  "http",
  "--project-ref",   "${SUPABASE_REF}",
  "--access-token",  "${SUPABASE_ACCESS_TOKEN}",
  "--port",          "3000"
]

# tell Docker/Render that we intend to listen on 3000
EXPOSE 3000

