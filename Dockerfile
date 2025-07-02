FROM n8nio/n8n:latest

USER root
# install the Supabase MCP server globally
RUN npm install -g @supabase/mcp-server-supabase
USER node


