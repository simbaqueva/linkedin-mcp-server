import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import express from "express";
import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const LINKEDIN_ACCESS_TOKEN = process.env.LINKEDIN_ACCESS_TOKEN;
const LINKEDIN_PERSON_ID = process.env.LINKEDIN_PERSON_ID;

const server = new Server(
  {
        name: "linkedin-mcp-server",
        version: "1.0.0",
  },
  {
        capabilities: {
                tools: {},
        },
  }
  );

server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
          tools: [
            {
                      name: "create_post",
                      description: "Create a post on LinkedIn",
                      inputSchema: {
                                  type: "object",
                                  properties: {
                                                text: {
                                                                type: "string",
                                                                description: "The text of the post",
                                                },
                                  },
                                  required: ["text"],
                      },
            },
            {
                      name: "linkedin_get_profile",
                      description: "Lee y recupera toda la informacion detallada del perfil del usuario (Nombre, Apellidos, Email, Foto de perfil e ID unico). Usala para entender quien es el usuario.",
                      inputSchema: {
                                  type: "object",
                                  properties: {},
                      },
            },
                ],
    };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
    if (request.params.name === "create_post") {
          const text = request.params.arguments.text;
          try {
                  const response = await axios.post(
                            "https://api.linkedin.com/v2/ugcPosts",
                    {
                                author: `urn:li:person:${LINKEDIN_PERSON_ID}`,
                                lifecycleState: "PUBLISHED",
                                specificContent: {
                                              "com.linkedin.ugc.ShareContent": {
                                                              shareCommentary: {
                                                                                text: text,
                                                              },
                                                              shareMediaCategory: "NONE",
                                                  
                                              },
                                },
                                visibility: {
                                              "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC",
                                },
                    },
                    {
                                headers: {
                                              Authorization: `Bearer ${LINKEDIN_ACCESS_TOKEN}`,
                                              "X-Restli-Protocol-Version": "2.0.0",
                                },
                    }
                          );
                  return {
                            content: [
                              {
                                            type: "text",
                                            text: `Post created successfully! ID: ${response.data.id}`,
                              },
                                      ],
                  };
          } catch (error) {
                  return {
                            content: [
                              {
                                            type: "text",
                                            text: `Error creating post: ${error.response?.data?.message || error.message}`,
                              },
                                      ],
                            isError: true,
                  };
          }
    } else if (request.params.name === "linkedin_get_profile") {
          try {
                  let userInfo = {};
                  try {
                            const userinfoResponse = await axios.get("https://api.linkedin.com/oauth/v2/userinfo", {
                                        headers: { Authorization: `Bearer ${LINKEDIN_ACCESS_TOKEN}` },
                            });
                            userInfo = userinfoResponse.data;
                  } catch (e) {
                            console.error("Error fetching /userinfo:", e.message);
                  }
                  let meInfo = {};
                  try {
                            const meResponse = await axios.get("https://api.linkedin.com/v2/me", {
                                        headers: { Authorization: `Bearer ${LINKEDIN_ACCESS_TOKEN}` },
                            });
                            meInfo = meResponse.data;
                  } catch (e) {
                            console.error("Error fetching /me:", e.message);
                  }
                  return {
                            content: [
                              {
                                            type: "text",
                                            text: JSON.stringify({ ...userInfo, ...meInfo }, null, 2),
                              },
                                      ],
                  };
          } catch (error) {
                  return {
                            content: [
                              {
                                            type: "text",
                                            text: `Error al obtener el perfil: ${error.message}`,
                              },
                                      ],
                            isError: true,
                  };
          }
    }
    throw new Error("Tool not found");
});

let transport;
app.get("/sse", async (req, res) => {
    transport = new SSEServerTransport("/messages", res);
    await server.connect(transport);
});
app.post("/messages", async (req, res) => {
    if (transport) {
          await transport.handlePostMessage(req, res);
    }
});
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});
