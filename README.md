# Supabase MCP Server

An MCP server that provides tools for interacting with Supabase databases, storage, and edge functions.

## Features

### Database Operations
- Create records with returning fields
- Read records with filtering, joins, and field selection
- Update records with filtering and returning fields
- Delete records with filtering and returning fields

### Storage Operations
- Upload files with options (cache control, content type, upsert)
- Download files from storage buckets

### Edge Functions
- Invoke Supabase Edge Functions with parameters and custom options

### Management Operations
- List and manage Supabase projects
- Create and manage organizations
- Retrieve project API keys

### User Management
- List and search users
- Create and manage user accounts
- Assign and manage user roles
- Update user profiles and settings

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create a `.env` file based on `.env.example`:
```bash
SUPABASE_URL=your_project_url_here
SUPABASE_KEY=your_service_role_key_here
SUPABASE_ACCESS_TOKEN=your_access_token_here  # Required for management operations
```

3. Build the server:
```bash
npm run build
```

4. Add to MCP settings (cline_mcp_settings.json):
```json
{
  "mcpServers": {
    "supabase": {
      "command": "node",
      "args": ["path/to/supabase-server/build/index.js"],
      "env": {
        "SUPABASE_URL": "your_project_url",
        "SUPABASE_KEY": "your_service_role_key",
        "SUPABASE_ACCESS_TOKEN": "your_access_token"
      }
    }
  }
}
```

## Available Tools

### Database Tools

#### create_record
Create a new record in a table.
```typescript
{
  table: string;
  data: Record<string, any>;
  returning?: string[];
}
```

#### read_records
Read records from a table with filtering and joins.
```typescript
{
  table: string;
  select?: string[];
  filter?: Record<string, any>;
  joins?: Array<{
    type?: 'inner' | 'left' | 'right' | 'full';
    table: string;
    on: string;
  }>;
}
```

#### update_record
Update records in a table.
```typescript
{
  table: string;
  data: Record<string, any>;
  filter?: Record<string, any>;
  returning?: string[];
}
```

#### delete_record
Delete records from a table.
```typescript
{
  table: string;
  filter?: Record<string, any>;
  returning?: string[];
}
```

### Storage Tools

#### upload_file
Upload a file to storage.
```typescript
{
  bucket: string;
  path: string;
  file: File | Blob;
  options?: {
    cacheControl?: string;
    contentType?: string;
    upsert?: boolean;
  };
}
```

#### download_file
Download a file from storage.
```typescript
{
  bucket: string;
  path: string;
}
```

### Function Tools

#### invoke_function
Invoke an Edge Function.
```typescript
{
  function: string;
  params?: Record<string, any>;
  options?: {
    headers?: Record<string, string>;
    responseType?: 'json' | 'text' | 'arraybuffer';
  };
}
```

### Management Tools

#### list_projects
List all Supabase projects.
```typescript
{
  // No parameters required
}
```

#### get_project
Get details of a specific Supabase project.
```typescript
{
  project_id: string;
}
```

#### create_project
Create a new Supabase project.
```typescript
{
  name: string;
  organization_id: string;
  region: string;
  db_pass: string;
  plan?: 'free' | 'pro' | 'team' | 'enterprise';
}
```

#### delete_project
Delete a Supabase project.
```typescript
{
  project_id: string;
}
```

#### list_organizations
List all organizations.
```typescript
{
  // No parameters required
}
```

#### get_organization
Get details of a specific organization.
```typescript
{
  organization_id: string;
}
```

#### create_organization
Create a new organization.
```typescript
{
  name: string;
}
```

#### get_project_api_keys
Get API keys for a specific Supabase project.
```typescript
{
  project_id: string;
}
```

### User Management Tools

#### list_users
List all users in a project with pagination.
```typescript
{
  page?: number;
  per_page?: number;
}
```

#### get_user
Get details of a specific user.
```typescript
{
  user_id: string;
}
```

#### create_user
Create a new user.
```typescript
{
  email: string;
  password: string;
  data?: Record<string, any>; // Additional user metadata
}
```

#### update_user
Update a user's details.
```typescript
{
  user_id: string;
  email?: string;
  password?: string;
  data?: Record<string, any>; // Additional user metadata to update
}
```

#### delete_user
Delete a user.
```typescript
{
  user_id: string;
}
```

#### assign_user_role
Assign a role to a user.
```typescript
{
  user_id: string;
  role: string;
}
```

#### remove_user_role
Remove a role from a user.
```typescript
{
  user_id: string;
  role: string;
}
