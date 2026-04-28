import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { CallToolRequestSchema, ListToolsRequestSchema, } from "@modelcontextprotocol/sdk/types.js";
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
                                                            name: "get_profile",
                                                            description: "Lee y recupera toda la informacion detallada del perfil del usuario. Usala para entender quien es el usuario.",
                                                            inputSchema: {
                                                                                        type: "object",
                                                                                        properties: {},
                                                            },
                                    },
                                    {
                                                            name: "get_experience",
                                                            description: "Obtiene el historial laboral del usuario",
                                                            inputSchema: {
                                                                                        type: "object",
                                                                                        properties: {},
                                                            },
                                    },
                                            ],
            };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
            const { name, arguments: args } = request.params;

                             if (name === "create_post") {
                                             const text = args.text;
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
                             }
         else if (name === "get_profile") {
                         try {
                                             let profileData = null;

                             // Intento 1: /v2/userinfo
                             try {
                                                     const response = await axios.get("https://api.linkedin.com/v2/userinfo", {
                                                                                 headers: { Authorization: `Bearer ${LINKEDIN_ACCESS_TOKEN}` },
                                                     });
                                                     if (response.data && Object.keys(response.data).length > 0) {
                                                                                 profileData = response.data;
                                                     }
                             } catch (e) {
                                                     console.error("Error fetching /v2/userinfo:", e.message);
                             }

                             // Intento 2: /v2/me (si el anterior fallo o esta vacio)
                             if (!profileData) {
                                                     try {
                                                                                 const response = await axios.get("https://api.linkedin.com/v2/me", {
                                                                                                                 headers: { Authorization: `Bearer ${LINKEDIN_ACCESS_TOKEN}` },
                                                                                         });
                                                                                 if (response.data && Object.keys(response.data).length > 0) {
                                                                                                                 profileData = response.data;
                                                                                         }
                                                     } catch (e) {
                                                                                 console.error("Error fetching /v2/me:", e.message);
                                                     }
                             }

                             if (!profileData) {
                                                     return {
                                                                                 content: [{
                                                                                                                 type: "text",
                                                                                                                 text: "No se pudo recuperar informacion del perfil. Por favor, asegurate de que el token tenga los permisos necesarios (openid, profile, email) o intenta pegar tu informacion manualmente.",
                                                                                         }],
                                                     };
                             }

                             return {
                                                     content: [{
                                                                                 type: "text",
                                                                                 text: JSON.stringify(profileData, null, 2),
                                                     }],
                             };
                         } catch (error) {
                                             return {
                                                                     content: [{
                                                                                                 type: "text",
                                                                                                 text: `Error al obtener el perfil: ${error.message}`,
                                                                     }],
                                                                     isError: true,
                                             };
                         }
         }
         else if (name === "get_experience") {
                         return {
                                             content: [{
                                                                     type: "text",
                                                                     text: "LinkedIn requiere el permiso r_basicprofile para leer el historial laboral, el cual no esta disponible en apps auto-gestionadas. Por favor, pide al usuario que pegue su experiencia manualmente.",
                                             }]
                         };
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
