/**
 * Email service client that communicates with the scheduler service
 * This replaces the direct nodemailer implementation to avoid deployment issues
 */
export class EmailService {
    private static readonly SCHEDULER_URL = process.env.SCHEDULER_URL || "http://localhost:4005";

    /**
     * Send an email via the scheduler service
     * @param toEmail - Recipient email address
     * @param subject - Email subject
     * @param body - Email body content
     */
    static async sendEmail(toEmail: string, subject: string, body: string): Promise<boolean> {
        try {
            const response = await fetch(`${this.SCHEDULER_URL}/email/send`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    toEmail,
                    subject,
                    body,
                }),
            });

            const result = await response.json();
            
            if (response.ok && result.ok) {
                console.log("✅ Email sent successfully via scheduler");
                console.log(`   To: ${toEmail}`);
                console.log(`   Subject: ${subject}`);
                return true;
            } else {
                console.error("❌ Failed to send email via scheduler:", result.error);
                return false;
            }
        } catch (error) {
            console.error("❌ Error communicating with scheduler service:", error);
            return false;
        }
    }

    /**
     * Send comprehensive records as formatted form data
     * @param toEmail - Recipient email address
     * @param comprehensiveRecord - The comprehensive record data
     */
    static async sendComprehensiveRecords(toEmail: string, comprehensiveRecord: any): Promise<boolean> {
        try {
            const response = await fetch(`${this.SCHEDULER_URL}/email/comprehensive-records`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    toEmail,
                    comprehensiveRecord,
                }),
            });

            const result = await response.json();
            
            if (response.ok && result.ok) {
                console.log("✅ Comprehensive records sent successfully via scheduler");
                return true;
            } else {
                console.error("❌ Failed to send comprehensive records via scheduler:", result.error);
                return false;
            }
        } catch (error) {
            console.error("❌ Error sending comprehensive records via scheduler:", error);
            return false;
        }
    }

    /**
     * Send a simple notification email
     * @param toEmail - Recipient email address  
     * @param message - Simple message content
     */
    static async sendNotification(toEmail: string, message: string): Promise<boolean> {
        try {
            const response = await fetch(`${this.SCHEDULER_URL}/email/notification`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    toEmail,
                    message,
                }),
            });

            const result = await response.json();
            
            if (response.ok && result.ok) {
                console.log("✅ Notification sent successfully via scheduler");
                return true;
            } else {
                console.error("❌ Failed to send notification via scheduler:", result.error);
                return false;
            }
        } catch (error) {
            console.error("❌ Error sending notification via scheduler:", error);
            return false;
        }
    }
}
