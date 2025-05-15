import 'dotenv/config';
//console.log("[DEBUG] newrelic-addition-mcp/index.js loaded");
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

// #region Server Configuration
const server = new McpServer({
  name: "Number Addition",
  version: "1.0.0", 
  description: "This MCP server provides a tool for adding numbers. It can be used to add numbers in an expression, or to provide help on how to use the 'add' tool.",
  icon: "https://newrelic.com/favicon.ico",
  author: "New Relic",
  contact: "https://newrelic.com/contact",
  license: "MIT",
  website: "https://newrelic.com",
  tags: ["addition", "numbers", "calculator", "math", "tool"],
  categories: ["math", "calculator", "tool"],
  keywords: ["addition", "numbers", "calculator", "math", "tool"]
});
// #endregion

// #region Example Addition Tools
export function addExpression(expression) {
  const parts = expression.split('+').map(num => num.trim());
  if (parts.length < 2 || parts.some(part => part === '' || isNaN(Number(part)))) {
    throw new Error('Invalid expression. Please provide a valid addition expression with numbers separated by plus signs (e.g., "7+9+2"). No trailing or consecutive plus signs allowed.');
  }
  const numbers = parts.map(num => Number(num));
  return numbers.reduce((sum, n) => sum + n, 0);
}

// This is the tool definition for the 'add' tool.
// It takes an expression as input and returns the sum of the numbers in the expression.
server.tool("add",
  { expression: z.string() },
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

// #region Highspot API Integration Tools
async function searchHighspot(query) {
  const encodedQuery = encodeURIComponent(query);
  const url = `https://api-su2.highspot.com/v1.0/search/items?query-string=${encodedQuery}&start=0&limit=10&sortby=relevancy`;

  // Use username and password from environment variables for HTTP Basic Auth
  const username = process.env.HIGHSPOT_USERNAME;
  const password = process.env.HIGHSPOT_PASSWORD;
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


// New Tool 2: searchHighspot
// This tool is used to search the Highspot knowledge base.
// It takes a search query as input and returns the results of the search.
server.tool("searchHighspot",
  { query: z.string() },
  async ({ query }) => {
    try {
      const results = await searchHighspot(query);
      return {
        content: [{ type: "text", text: JSON.stringify(results) }]
      };
    } catch (err) { 
      return {
        content: [{ type: "text", text: err.message }]
      };
    }
  }
);
// #endregion


// #region Prompts
// New Prompt 1: requestExpressionForAddition
// This prompt is used to request an addition expression from the user.
// It also provides a way to try the 'add' tool directly from the prompt. 
// It expects a non-empty string and returns the sum of the numbers in the expression.
server.prompt(
  "requestExpressionForAddition",
  "Sure, I can help with that! What is the addition expression you'd like me to calculate? (e.g., '12+3+5')",
  z.string().min(1, "Please provide an expression."), // Expects a non-empty string
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
// This prompt is used to provide help on how to use the 'add' tool.
// It also provides a way to try the 'add' tool directly from the prompt. 
// It expects an optional string and returns the sum of the numbers in the expression.  
server.prompt(
  "guidedAdditionHelp",
  `The 'add' tool sums numbers (e.g., '@add expression="5+10+15"').  Would you like me to calculate an expression for you now? If so, please provide it.`,

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
//console.log("[DEBUG] MCP Server: About to create StdioServerTransport");
const transport = new StdioServerTransport();
//console.log("[DEBUG] MCP Server: StdioServerTransport created.");
//console.log("[DEBUG] MCP Server: About to call server.connect(transport)");
try {
  await server.connect(transport);
  //console.log("[DEBUG] MCP Server: server.connect(transport) completed successfully.");
} catch (connectError) {
  //console.error("[ERROR] MCP Server: Error during server.connect(transport):", connectError);
} 
// #endregion
