/**
 * Email service client that communicates with the scheduler service
 * This replaces the direct nodemailer implementation to avoid deployment issues
 */
export class EmailService {
    private static readonly SCHEDULER_URL = (process.env.SCHEDULE_URL || "http://localhost:4005").replace(/\/+$/, '');

    /**
     * Send an email via the scheduler service
     * @param toEmail - Recipient email address
     * @param subject - Email subject
     * @param body - Email body content
     */
    static async sendEmail(toEmail: string, subject: string, body: string): Promise<boolean> {
        console.log("📧 [EmailService] Starting sendEmail request");
        console.log(`📧 [EmailService] Scheduler URL: ${this.SCHEDULER_URL}`);
        console.log(`📧 [EmailService] To: ${toEmail}`);
        console.log(`📧 [EmailService] Subject: ${subject}`);
        console.log(`📧 [EmailService] Body length: ${body.length} characters`);
        
        try {
            const requestUrl = `${this.SCHEDULER_URL}/email/send`;
            console.log(`📧 [EmailService] Request URL: ${requestUrl}`);
            
            const requestBody = {
                toEmail,
                subject,
                body,
            };
            console.log(`📧 [EmailService] Request body:`, JSON.stringify(requestBody, null, 2));

            const response = await fetch(requestUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody),
            });

            console.log(`📧 [EmailService] Response status: ${response.status}`);
            // console.log(`📧 [EmailService] Response headers:`, Object.fromEntries(response.headers.entries()));

            const result = await response.json();
            console.log(`📧 [EmailService] Response body:`, JSON.stringify(result, null, 2));
            
            if (response.ok && result.ok) {
                console.log("✅ [EmailService] Email sent successfully via scheduler");
                console.log(`   To: ${toEmail}`);
                console.log(`   Subject: ${subject}`);
                return true;
            } else {
                console.error("❌ [EmailService] Failed to send email via scheduler:", result.error);
                return false;
            }
        } catch (error) {
            console.error("❌ [EmailService] Error communicating with scheduler service:");
            console.error("   Error type:", typeof error);
            console.error("   Error message:", error.message);
            console.error("   Error stack:", error.stack);
            console.error("   Full error:", error);
            return false;
        }
    }

    /**
     * Send comprehensive records as formatted form data
     * @param toEmail - Recipient email address
     * @param comprehensiveRecord - The comprehensive record data
     */
    static async sendComprehensiveRecords(toEmail: string, comprehensiveRecord: any): Promise<boolean> {
        console.log("📧 [EmailService] Starting sendComprehensiveRecords request");
        console.log(`📧 [EmailService] Scheduler URL: ${this.SCHEDULER_URL}`);
        console.log(`📧 [EmailService] To: ${toEmail}`);
        console.log(`📧 [EmailService] Record keys:`, Object.keys(comprehensiveRecord || {}));
        
        try {
            const requestUrl = `${this.SCHEDULER_URL}/email/comprehensive-records`;
            console.log(`📧 [EmailService] Request URL: ${requestUrl}`);
            
            const requestBody = {
                toEmail,
                comprehensiveRecord,
            };
            console.log(`📧 [EmailService] Request body size: ${JSON.stringify(requestBody).length} characters`);

            const response = await fetch(requestUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody),
            });

            console.log(`📧 [EmailService] Response status: ${response.status}`);
            // console.log(`📧 [EmailService] Response headers:`, Object.fromEntries(response.headers.entries()));

            const result = await response.json();
            console.log(`📧 [EmailService] Response body:`, JSON.stringify(result, null, 2));
            
            if (response.ok && result.ok) {
                console.log("✅ [EmailService] Comprehensive records sent successfully via scheduler");
                return true;
            } else {
                console.error("❌ [EmailService] Failed to send comprehensive records via scheduler:", result.error);
                return false;
            }
        } catch (error) {
            console.error("❌ [EmailService] Error sending comprehensive records via scheduler:");
            console.error("   Error type:", typeof error);
            console.error("   Error message:", error.message);
            console.error("   Error stack:", error.stack);
            console.error("   Full error:", error);
            return false;
        }
    }

    /**
     * Send a simple notification email
     * @param toEmail - Recipient email address  
     * @param message - Simple message content
     */
    static async sendNotification(toEmail: string, message: string): Promise<boolean> {
        console.log("📧 [EmailService] Starting sendNotification request");
        console.log(`📧 [EmailService] Scheduler URL: ${this.SCHEDULER_URL}`);
        console.log(`📧 [EmailService] To: ${toEmail}`);
        console.log(`📧 [EmailService] Message: ${message}`);
        
        try {
            const requestUrl = `${this.SCHEDULER_URL}/email/notification`;
            console.log(`📧 [EmailService] Request URL: ${requestUrl}`);
            
            const requestBody = {
                toEmail,
                message,
            };
            console.log(`📧 [EmailService] Request body:`, JSON.stringify(requestBody, null, 2));

            const response = await fetch(requestUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody),
            });

            console.log(`📧 [EmailService] Response status: ${response.status}`);
            // console.log(`📧 [EmailService] Response headers:`, Object.fromEntries(response.headers.entries()));

            const result = await response.json();
            console.log(`📧 [EmailService] Response body:`, JSON.stringify(result, null, 2));
            
            if (response.ok && result.ok) {
                console.log("✅ [EmailService] Notification sent successfully via scheduler");
                return true;
            } else {
                console.error("❌ [EmailService] Failed to send notification via scheduler:", result.error);
                return false;
            }
        } catch (error) {
            console.error("❌ [EmailService] Error sending notification via scheduler:");
            console.error("   Error type:", typeof error);
            console.error("   Error message:", error.message);
            console.error("   Error stack:", error.stack);
            console.error("   Full error:", error);
            return false;
        }
    }
}
