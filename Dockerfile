# Dockerfile
FROM node:18-alpine

# Create app dir
WORKDIR /app

# Install the supabase MCP server binary
RUN npm install @supabase/mcp-server-supabase@latest

# Expose the default MCP port
EXPOSE 3333

# Pass your token in via ENV at runtime
ENV SUPABASE_ACCESS_TOKEN=${SUPABASE_ACCESS_TOKEN}

# Start the MCP server on port 3333 for your project
CMD ["npx", "@supabase/mcp-server-supabase@latest", \
     "--project-ref=pkvnfcdodzwbvcxkmxj", "--port=3333"]
