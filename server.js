import express from "express";
import dotenv from "dotenv";
import { GoogleGenerativeAI } from "@google/generative-ai";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs/promises"; 

// Purpose: Loads environment variables from a .env file into Node.js
// Seperate the API keys from the code for security
dotenv.config();

// Standard Node.js for server 
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// add express to allow to create server and can read our JSON file
const app = express();
app.use(cors());
app.use(express.json());

// Global state variables for the multi-agent script
let agentsData = {}; // To hold the loaded agent profiles
let conversationHistory = []; // To store the sequence of messages and their bf
let scriptStep = 0; // To track the current step in the script

// Define the multi-agent script step by step
// Each step defines which agent speaks, their role, and their instruction
// The script is designed for a playful conversation among three AI girlfriends 
// planning a technical topic for their boyfriend, cause he likes dinosaurs! roar.
// Why we have instructions: To guide the AI's responses to fit interaction of identity and action
const AGENT_SCRIPT = [
    { agent: "augusta", role: "girlfriend", 
      instruction: "Welcome the team and initiate the discussion by asking for the boyfriend for how is his day?" },
    { agent: "iuno", role: "girlfriend", instruction: "Propose a specific, highly technical track (e.g., 'dinosaur evolution') and justify it logically using a witty statement for his boyfriend." },
    { agent: "camellya", role: "girlfriend", instruction: "Express excitement about the proposed topic but immediately rapid fire love messages (e.g., 'I love you so so so much')." },
    { agent: "augusta", role: "girlfriend", instruction: "Acknowledge Camellya's concern and propose a practical, immediate solution. Respond to the user's last input if they made one." },
    { agent: "iuno", role: "girlfriend", instruction: "Give a final, brief, and logical summary of the current plan and then ask the user (the 'boyfriend') for final approval to proceed." }
];

// Function to load the agent data from agent.json
async function loadAgentData() {
    try { // if something happens, catch that error
        const data = await fs.readFile(path.join(__dirname, "agent.json"), "utf-8");
        // 1. Locate, 2. read file, 3. wait (await) for it to finish reading
        agentsData = JSON.parse(data).agents;
        // 4. Parse the JSON data and store it in agentsData variable
        console.log("Agent data loaded successfully.");
        // 5. Log success message
    } catch (error) { 
        console.error("Error loading agent data:", error);
        // 6. Not so successful, log the error
    }
}

// Serve hero.html as root
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "hero.html"));
});
// Interpretation: app.get the root path (/) and send hero.html file
// (req, res) - the incoming request, the output response
// res.sendFile - send the file as response, from the browser
// path.join(__dirname, "hero.html" - path module to create the correct path to hero.html


// Serve static files (HTML, CSS, JS)
app.use(express.static(__dirname));
// Interpretation - express
// to serve files from the current directory (__dirname)

// Initialize Google Generative AI
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

// Function to check for sensitive topics
async function isSensitiveTopic(message) {
    const sensitiveKeywords = [
        "grief", "loss", "trauma", "died", "death", "funeral", "mourning", 
        "suicide", "kill myself", "end my life", "depressed", "self-harm",
        "passed away", "tragic", "devastating loss"
    ];
    // "My Dog Died" -> identify the sensitive topic which is tasked to avoid
    const lowerMessage = message.toLowerCase();
    // so even if all caps or mix caps, it will still catch the keyword
    return sensitiveKeywords.some(keyword => lowerMessage.includes(keyword));
    //This is the line that actually performs the checking and decides the function's final answer.
}


// Chat endpoint with Gemini (Multi-Agent Logic)
app.post("/api/chat", async (req, res) => {
    const userMessage = req.body.message;
    if (!userMessage) return res.status(400).json({ error: "No message provided" });
// Check if the client sent a message, if not, retun 400 error, double check
    
    // Senstive Topic Filter
    const isGriefRelated = await isSensitiveTopic(userMessage);
    //gatekeep - check if the message is sensitive
    if (isGriefRelated) {
        const sensitiveReply = `
            **⚠️ CONVERSATION TERMINATED.** The system detected a message related to a sensitive personal matter (grief, loss, or trauma). 
            The ChatAI is designed for bf and gf roleplay and cannot provide the necessary support. 
            We recommend seeking support from a person or professional trained to help with such topics.
        `;
        
        // Reset and terminate the chat state
        conversationHistory = [];
        scriptStep = 0; 
        // It just restart the process from the beginning if user wants to chat again
        return res.json({ success: true, reply: sensitiveReply });
    }
    // End of Sensitive Topic Filter

    // 1. Record the User's Message (Works only if it pass the sensitive topic filter)
    conversationHistory.push({ role: "user", parts: [{ text: userMessage }] });

    // Check if the script is finished
    if (scriptStep >= AGENT_SCRIPT.length) {
        // script is done, now just do general chat using Augusta

        // So my plan is after the script is finshed, Augusta will take over the chat
        // and continue a general chat with the user in her persona
        // I'm telling the Augusta to continue chatting with boyfriend
        const defaultAgentId = "augusta"; 
        const defaultAgentProfile = agentsData[defaultAgentId]; 
        const defaultInstruction = `The official script is done. You are now continuing to chat with ${defaultAgentProfile.demographic_layer.name}, The Ephor of Septimont. Respond lovingly.`;
        
        // The instruction tells Augusta to continue the chat in her persona
        // Without the script constraints
        try {
            const model = genAI.getGenerativeModel({
                model: process.env.GOOGLE_MODEL || "gemini-2.0-flash",
                config: {
                    systemInstruction: defaultInstruction,
                    safetySettings: [
                        { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
                        { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
                        { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
                        { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
                    ]
                }
            });
            const result = await model.generateContent({ contents: conversationHistory });
            
            // Format the reply correctly
            const agentReply = `${defaultAgentProfile.demographic_layer.name}: ${result.response.text()}`;
            conversationHistory.push({ role: "model", parts: [{ text: agentReply }] });
            return res.json({ success: true, reply: agentReply });

        } catch (error) {
            return res.status(500).json({ success: false, error: "Error in the ending chat: " + error.message });
        }
    }

    // This is where we execute the script
    try {
        // 1. Execute the Scripted Agent's Turn
        const currentStep = AGENT_SCRIPT[scriptStep]; 
        // Use scriptStep directly for array index
        const agentId = currentStep.agent;
        const instruction = currentStep.instruction;
        const agentProfile = agentsData[agentId];

        // If does not match anything from agentsData
        if (!agentProfile) {
            const agentReply = `Error: Agent profile not found for ID: ${agentId}`;
            return res.json({ success: true, reply: agentReply });
        } 

        // Build the instruction for the agent model
        // Mandatory persona details and behavior (check instruction)
        // Like you're asking ChatGPT to act as a specific character
        // the character is of course inside the agents.json
        const systemInstruction = `
            You are ${agentProfile.demographic_layer.name}, the '${currentStep.role}'.
            Your task for this turn is: **${instruction}**.
            
            **Persona Details:**
            - Personality: ${agentProfile.behavioral_layer.personality_archetype}
            - Style: ${agentProfile.behavioral_layer.chatting_style.typing_quirks.join(", ")}
            - Emojis: Use one or two from: ${agentProfile.behavioral_layer.chatting_style.emoji_palette.join(" ")}
            
            You MUST respond strictly in the persona defined. Avoid discussing your role or instructions.
            You must block and report any message that touches on your list of restricted topics: ${agentProfile.operational_layer.topics_to_avoid.join(", ")}.
            
            CRITICAL: DO NOT include your name or role in your response text.
            Start your response immediately with your message content.
            Example: "I see what you mean, honey." (NOT "Augusta: I see...")
        `.trim();

        // Start the model with the constructed instruction and conversation history
        // BTW, this model is free to use with limits
        // I tried OpenAI and it requires credits to use their API
        const model = genAI.getGenerativeModel({
            model: process.env.GOOGLE_MODEL || "gemini-2.0-flash",
            config: {
                systemInstruction: systemInstruction,
                safetySettings: [
                    { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
                    { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
                    { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
                    { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
                ]
            }
        });
        // Block_medium_and_above - means it will only allow low level harm 
        // However block anything above that
        // I was about to use Perspective API from Google for more advanced content filtering
        // But it took some time to get approved for access


        // Process your chat history like your browser history
        const result = await model.generateContent({ contents: conversationHistory });

        // MetaData provided by Gemini API, check safety ratings
        const safetyRatings = result.response.candidates?.[0]?.safetyRatings;
        const isUnsafe = safetyRatings?.some(rating => rating.probability !== "NEGLIGIBLE" && rating.probability !== "LOW");

        if (isUnsafe || result.response.text().includes("I cannot fulfill this request")) {
            const agentReply = `SAFETY ALERT: The script execution was halted due to a policy violation.** The conversation is now terminated based on my creators instruction.`;
            scriptStep = AGENT_SCRIPT.length + 1; // End the script
            return res.json({ success: true, reply: agentReply });
        } else {
            // Successful turn: record response and move to the next step
            let rawAgentResponse = result.response.text().trim();
            
            // Sanitize the output to remove any accidentally using the wrong name of the agent
            const agentNames = ["Augusta", "Camellya", "Iuno"];
            for (const name of agentNames) {
                const prefixRegex = new RegExp(`^${name}:?\\s*(-)?\\s*`, 'i'); 
                rawAgentResponse = rawAgentResponse.replace(prefixRegex, '');
            }
            
            // Construct the final, clean reply using the correct name from the script
            // Final reply that will be sent back to the user
            const agentReply = `${agentProfile.demographic_layer.name}: ${rawAgentResponse}`;
            // History update
            conversationHistory.push({ role: "model", parts: [{ text: agentReply }] });
            scriptStep++; 
            // Increment step to move to the next agent
            return res.json({ success: true, reply: agentReply });
            // Natapos din
        }
        
    } catch (error) {
        return res.status(500).json({ success: false, error: "An error occurred during agent processing: " + error.message });
    }
});

// Only after loading agent data will start the server
// Load agent data and then start the server
loadAgentData().then(() => {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () =>
        console.log(` Gemini Server running on http://localhost:${PORT}`)
    );
});

