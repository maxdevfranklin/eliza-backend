// Test script to verify metadata handling

// Mock the analyzeResponseContext function
function analyzeResponseContext(aiResponse) {
    let responseText;
    let status = "Normal situation"; // default status
    
    try {
        // Try to parse as JSON first
        const parsedResponse = JSON.parse(aiResponse);
        responseText = parsedResponse.response || aiResponse;
        status = parsedResponse.status || "Normal situation";
        
        // Validate status values
        if (status !== "Unexpected situation" && status !== "Normal situation") {
            status = "Normal situation"; // fallback to default if invalid status
        }
        
    } catch (parseError) {
        // If JSON parsing fails, use the raw response as fallback
        responseText = aiResponse;
        status = "Normal situation";
    }
    
    return {
        responseText,
        status
    };
}

// Test cases
console.log("=== Testing Metadata Handling ===");

// Test 1: Unexpected situation response
const test1 = `{"response": "I understand your concern about the cost. Grand Villa offers various pricing options starting at $2,195/month. Now, let me ask about your loved one's typical day.", "status": "Unexpected situation"}`;
const result1 = analyzeResponseContext(test1);
console.log("Test 1 - Unexpected Situation:");
console.log("Response Text:", result1.responseText);
console.log("Status:", result1.status);
console.log("Expected Return Object:", { text: result1.responseText, metadata: { responseStatus: result1.status } });
console.log("---");

// Test 2: Normal situation response
const test2 = `{"response": "Thank you for sharing that information. Could you tell me more about your loved one's daily routine?", "status": "Normal situation"}`;
const result2 = analyzeResponseContext(test2);
console.log("Test 2 - Normal Situation:");
console.log("Response Text:", result2.responseText);
console.log("Status:", result2.status);
console.log("Expected Return Object:", { text: result2.responseText, metadata: { responseStatus: result2.status } });
console.log("---");

// Test 3: Invalid JSON (fallback)
const test3 = "This is just a plain text response without JSON formatting";
const result3 = analyzeResponseContext(test3);
console.log("Test 3 - Invalid JSON (Fallback):");
console.log("Response Text:", result3.responseText);
console.log("Status:", result3.status);
console.log("Expected Return Object:", { text: result3.responseText, metadata: { responseStatus: result3.status } });
console.log("---");

console.log("=== Metadata Test Complete ==="); 