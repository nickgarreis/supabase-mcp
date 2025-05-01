//evals.ts

import { EvalConfig } from 'mcp-evals';
import { openai } from "@ai-sdk/openai";
import { grade, EvalFunction } from "mcp-evals";

const list_tablesEval: EvalFunction = {
    name: 'list_tables Tool Evaluation',
    description: '',
    run: async () => {
        const result = await grade(openai("gpt-4"), "Use the 'list_tables' tool to list all tables in the 'public' schema. Provide the results.");
        return JSON.parse(result);
    }
};

const create_recordEval: EvalFunction = {
    name: 'create_record Tool Evaluation',
    description: '',
    run: async () => {
        const result = await grade(openai("gpt-4"), "Use the 'create_record' tool to insert a record into a table named 'my_table' with data {\"name\":\"Alice\",\"age\":30} and return the inserted record.");
        return JSON.parse(result);
    }
};

const read_recordsEval: EvalFunction = {
    name: 'read_records Tool Evaluation',
    description: '',
    run: async () => {
        const result = await grade(openai("gpt-4"), "Use the 'read_records' tool to read records from a table named 'my_table' filtered by {\"name\":\"Alice\"}.");
        return JSON.parse(result);
    }
};

const update_recordsEval: EvalFunction = {
    name: 'update_records Tool Evaluation',
    description: '',
    run: async () => {
        const result = await grade(openai("gpt-4"), "Use the 'update_records' tool to update records in 'my_table' where {\"name\":\"Alice\"} setting the 'age' to 31. Return the updated records.");
        return JSON.parse(result);
    }
};

const delete_recordsEval: EvalFunction = {
    name: 'delete_records Tool Evaluation',
    description: '',
    run: async () => {
        const result = await grade(openai("gpt-4"), "Use the 'delete_records' tool to remove records from 'my_table' where {\"name\":\"Alice\"} and return the deleted entries.");
        return JSON.parse(result);
    }
};

const upload_fileEval: EvalFunction = {
    name: 'upload_file Tool Evaluation',
    description: '',
    run: async () => {
        const result = await grade(openai("gpt-4"), "Use the 'upload_file' tool to upload a base64 encoded text file to bucket named 'documents' at path 'notes/important.txt'. Return the upload response.");
        return JSON.parse(result);
    }
};

const download_fileEval: EvalFunction = {
    name: 'download_file Tool Evaluation',
    description: '',
    run: async () => {
        const result = await grade(openai("gpt-4"), "Use the 'download_file' tool to download a file from the 'documents' bucket at the path 'notes/important.txt'. Return the file contents.");
        return JSON.parse(result);
    }
};

const invoke_functionEval: EvalFunction = {
    name: 'invoke_function Tool Evaluation',
    description: '',
    run: async () => {
        const result = await grade(openai("gpt-4"), "Use the 'invoke_function' tool to call a Supabase Edge Function named 'processData' with parameters {\"input\":\"test\"}. Return the response.");
        return JSON.parse(result);
    }
};

const list_usersEval: EvalFunction = {
    name: 'list_users Tool Evaluation',
    description: '',
    run: async () => {
        const result = await grade(openai("gpt-4"), "Use the 'list_users' tool to list all users with page 1 and 10 per_page. Return the user list.");
        return JSON.parse(result);
    }
};

const create_userEval: EvalFunction = {
    name: 'create_user Tool Evaluation',
    description: '',
    run: async () => {
        const result = await grade(openai("gpt-4"), "Use the 'create_user' tool to create a user with email 'jane@example.com' and password 'Secr3tPa55'. Return the new user details.");
        return JSON.parse(result);
    }
};

const update_userEval: EvalFunction = {
    name: 'update_user Tool Evaluation',
    description: '',
    run: async () => {
        const result = await grade(openai("gpt-4"), "Use the 'update_user' tool to change the password of user_id '123' to 'NewPassword123'. Return the updated user details.");
        return JSON.parse(result);
    }
};

const delete_userEval: EvalFunction = {
    name: 'delete_user Tool Evaluation',
    description: '',
    run: async () => {
        const result = await grade(openai("gpt-4"), "Use the 'delete_user' tool to remove the user with user_id '123'. Return a success message.");
        return JSON.parse(result);
    }
};

const assign_user_roleEval: EvalFunction = {
    name: 'assign_user_role Tool Evaluation',
    description: '',
    run: async () => {
        const result = await grade(openai("gpt-4"), "Use the 'assign_user_role' tool to assign the role 'editor' to user_id '123'. Return a success message.");
        return JSON.parse(result);
    }
};

const remove_user_roleEval: EvalFunction = {
    name: 'remove_user_role Tool Evaluation',
    description: '',
    run: async () => {
        const result = await grade(openai("gpt-4"), "Use the 'remove_user_role' tool to remove the role 'editor' from user_id '123'. Return a success message.");
        return JSON.parse(result);
    }
};

const config: EvalConfig = {
    model: openai("gpt-4"),
    evals: [list_tablesEval]
};
  
export default config;
  
export const evals = [list_tablesEval];