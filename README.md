# MCP Server for Highspot
MCP Server for Highspot API, enabling NOVA to interact with Highspot.

## Highspot.com API docs
[API Docs](https://help.highspot.com/hc/en-us/articles/22111152214427-Use-the-Highspot-REST-API)

## Tools

1) `math_addition_example_prompt`
   * This prompt helps you add numbers. What is the addition expression you'd like me to calculate? (e.g., '12+3+5')
   * Required Inputs:
     * `args` (string): The addition expression, like '2+3+4'.
   * Returns: Sum of the numbers being added

2) `search_highspot_prompt`
   * This prompt helps you search the Highspot knowledge base. What would you like to search for?
   * Required Inputs:
     * `args` (string): Your search query for Highspot.
   * Returns: Your search query for Highspot.

## Setup
