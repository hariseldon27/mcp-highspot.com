import 'dotenv/config';
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
// Schemas for ListPrompts and GetPrompt are likely handled by the server internally
// if server.setRequestHandler is removed. We keep the import if they are needed elsewhere,
// but their explicit handling via setRequestHandler is removed.
// import {
//   ListPromptsRequestSchema,  // No longer used with setRequestHandler
//   GetPromptRequestSchema    // No longer used with setRequestHandler
// } from "@modelcontextprotocol/sdk/types.js"; 

// #region Server Configuration
const server = new McpServer({
  name: "Number Addition & Highspot Search",
  version: "1.0.0",
  description: "This MCP server provides tools for adding numbers and searching Highspot.",
  icon: "https://newrelic.com/favicon.ico", // Replace with a more relevant icon if available
  author: "New Relic", // Replace with actual author
  contact: "https://newrelic.com/contact", // Replace with actual contact
  license: "MIT",
  website: "https://newrelic.com", // Replace with actual website
  tags: ["addition", "numbers", "calculator", "math", "tool", "highspot", "search"],
  categories: ["math", "calculator", "tool", "search"],
  keywords: ["addition", "numbers", "calculator", "math", "tool", "highspot", "search"]
});
// #endregion

// #region Example Addition Tools / Functions
export function addExpression(expression) {
  const parts = expression.split('+').map(num => num.trim());
  if (parts.length < 2 || parts.some(part => part === '' || isNaN(Number(part)))) {
    throw new Error('Invalid expression. Please provide a valid addition expression with numbers separated by plus signs (e.g., "7+9+2"). No trailing or consecutive plus signs allowed.');
  }
  const numbers = parts.map(num => Number(num));
  return numbers.reduce((sum, n) => sum + n, 0);
}

server.tool("mathAdditionExample",
  { expression: z.string().describe("An addition expression like '2+3+4'") },
  async ({ expression }) => {
    try {
      return {
        content: [{ type: "text", text: String(addExpression(expression)) }]
      };
    } catch (err) {
      return {
        content: [{ type: "text", text: err.message }]
      };
    }
  }
);
// #endregion

// #region Highspot API Integration Tools / Functions
async function searchHighspot(query) {
  const encodedQuery = encodeURIComponent(query);
  const url = `https://api-su2.highspot.com/v1.0/search/items?query-string=${encodedQuery}&start=0&limit=10&sortby=relevancy`;

  const username = process.env.HIGHSPOT_USERNAME;
  const password = process.env.HIGHSPOT_PASSWORD;

  if (!username || !password) {
    throw new Error("Highspot username or password not configured in environment variables (HIGHSPOT_USERNAME, HIGHSPOT_PASSWORD).");
  }
  const authString = Buffer.from(`${username}:${password}`).toString('base64');

  const response = await fetch(url, {
    method: "GET",
    headers: {
      "accept": "application/json",
      "Authorization": `Basic ${authString}`
    }
  });

  if (!response.ok) {
    throw new Error(`Highspot API error: ${response.status} ${response.statusText}`);
  }
  return await response.json();
}

server.tool("searchHighspot",
  { query: z.string().describe("The search query for Highspot.") },
  async ({ query }) => {
    try {
      const results = await searchHighspot(query);
      return {
        // Consider what parts of 'results' are most useful to return.
        // Returning the full JSON might be verbose for some models.
        content: [{ type: "text", text: JSON.stringify(results, null, 2) }] 
      };
    } catch (err) {
      return {
        content: [{ type: "text", text: err.message }]
      };
    }
  }
);
// #endregion

// #region Prompt Definitions
// Prompt for the mathAdditionExample tool
server.prompt(
  "math_addition_example_prompt", // Unique name for this prompt
  "This prompt helps you add numbers. What is the addition expression you'd like me to calculate? (e.g., '12+3+5')", // Initial message to the user
  z.object({ // Zod schema for the arguments this prompt expects
    expression: z.string().describe("The addition expression, like '2+3+4'.")
  }),
  async (args) => { // Handler function when the user provides the arguments
    try {
      const sum = addExpression(args.expression);
      return {
        content: [{ type: "text", text: `The sum of '${args.expression}' is ${sum}.` }]
      };
    } catch (err) {
      return {
        content: [{ type: "text", text: `I encountered an issue with that expression: ${err.message}` }]
      };
    }
  }
);

// Prompt for the searchHighspot tool
server.prompt(
  "search_highspot_prompt", // Unique name for this prompt
  "This prompt helps you search the Highspot knowledge base. What would you like to search for?", // Initial message
  z.object({ // Zod schema for arguments
    query: z.string().describe("Your search query for Highspot.")
  }),
  async (args) => { // Handler function
    try {
      const results = await searchHighspot(args.query);
      // Decide on the best way to present results. JSON stringify is one way.
      return {
        content: [
          { type: "text", text: `Okay, I searched Highspot for '${args.query}'.` },
          { type: "text", text: JSON.stringify(results, null, 2) } // Or a summary
        ]
      };
    } catch (err) {
      return {
        content: [{ type: "text", text: `I encountered an issue searching Highspot: ${err.message}` }]
      };
    }
  }
);


// Existing prompts (if they are still desired and distinct):
// New Prompt 1: requestExpressionForAddition (This seems similar to math_addition_example_prompt)
// You might want to consolidate or differentiate them if they serve very similar purposes.
server.prompt(
  "requestExpressionForAddition",
  "Sure, I can help with that! What is the addition expression you'd like me to calculate? (e.g., '12+3+5')",
  z.string().min(1, "Please provide an expression.").describe("The addition expression, like '12+3+5'"),
  async (expressionFromPrompt) => {
    try {
      const result = addExpression(expressionFromPrompt);
      return {
        content: [{ type: "text", text: `Okay, the sum of ${expressionFromPrompt} is ${result}.` }]
      };
    } catch (err) {
      return {
        content: [{ type: "text", text: `I encountered an issue: ${err.message}. Please try again with a valid expression.` }]
      };
    }
  }
);

// New Prompt 2: guidedAdditionHelp
server.prompt(
  "guidedAdditionHelp",
  `The 'add' tool sums numbers (e.g., '@add expression="5+10+15"'). Would you like me to calculate an expression for you now? If so, please provide it.`,
  z.string().optional().describe("Enter an addition expression if you'd like to try, or leave blank for just help."),
  async (expressionFromPrompt) => {
    if (expressionFromPrompt && expressionFromPrompt.trim() !== "") {
      try {
        const result = addExpression(expressionFromPrompt);
        return {
          content: [
            { type: "text", text: `Calculating '${expressionFromPrompt}'... The result is ${result}.` },
            { type: "text", text: "You can use the '@add' tool directly for future calculations." }
          ]
        };
      } catch (err) {
        return {
          content: [
            { type: "text", text: `Error: ${err.message}` },
            { type: "text", text: "Please ensure your expression is like '5+10+15'." }
          ]
        };
      }
    } else {
      return {
        content: [{ type: "text", text: `No problem. Remember to use '@add expression="your_expression" when you want to sum numbers.` }]
      };
    }
  }
);
// #endregion
  
// #region Server Connection
const transport = new StdioServerTransport();
try {
  await server.connect(transport);
  console.log("MCP Server connected via STDIN/STDOUT."); // Added a log message
} catch (connectError) {
  console.error("[ERROR] MCP Server: Error during server.connect(transport):", connectError);
}
// #endregion
