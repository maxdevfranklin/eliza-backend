import nodemailer from "nodemailer";
import { elizaLogger } from "@elizaos/core";

/**
 * Email service for sending notifications
 * Uses Gmail SMTP with app password authentication
 */
export class EmailService {
    private static readonly EMAIL_ADDRESS = "chrismazza.tech@gmail.com";
    private static readonly APP_PASSWORD = "lizx jhak oxyt woqm"; // 16-char Gmail app password

    /**
     * Send an email using Gmail SMTP
     * @param toEmail - Recipient email address
     * @param subject - Email subject
     * @param body - Email body content
     */
    static async sendEmail(toEmail: string, subject: string, body: string): Promise<boolean> {
        try {
            // Create SMTP transporter (matches your Python settings: Gmail + SSL 465)
            const transporter = nodemailer.createTransport({
                host: "smtp.gmail.com",
                port: 465,
                secure: true, // true for port 465
                auth: {
                    user: this.EMAIL_ADDRESS,
                    pass: this.APP_PASSWORD,
                },
            });

            // Send the email
            const info = await transporter.sendMail({
                from: this.EMAIL_ADDRESS,
                to: toEmail,
                subject: subject,
                text: body,
            });

            elizaLogger.info("✅ Email sent successfully");
            elizaLogger.info(`   To: ${toEmail}`);
            elizaLogger.info(`   Subject: ${subject}`);
            elizaLogger.info(`   Message ID: ${info.messageId}`);
            return true;
        } catch (error) {
            elizaLogger.error("❌ Error sending email:", error);
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
            const subject = "Grand Villa Discovery - Comprehensive Records";
            const body = this.formatComprehensiveRecordsAsForm(comprehensiveRecord);
            
            return await this.sendEmail(toEmail, subject, body);
        } catch (error) {
            elizaLogger.error("❌ Error sending comprehensive records:", error);
            return false;
        }
    }

    /**
     * Format comprehensive records as a readable form
     */
    private static formatComprehensiveRecordsAsForm(record: any): string {
        if (!record) {
            return "No comprehensive records available.";
        }

        const form = [
            "=== GRAND VILLA DISCOVERY COMPREHENSIVE RECORDS ===",
            "",
            "📅 Generated: " + new Date().toISOString(),
            "",
            "👤 CONTACT INFORMATION:",
            "   Name: " + (record.contact_info?.name || "Not provided"),
            "   Location: " + (record.contact_info?.location || "Not provided"),
            "   Loved One's Name: " + (record.contact_info?.loved_one_name || "Not provided"),
            "   Collected At: " + (record.contact_info?.collected_at || "Not available"),
            "",
            "🔍 SITUATION DISCOVERY:",
        ];

        if (record.situation_discovery && record.situation_discovery.length > 0) {
            record.situation_discovery.forEach((qa: any, index: number) => {
                form.push(`   ${index + 1}. Q: ${qa.question}`);
                form.push(`      A: ${qa.answer}`);
                // form.push(`      📅 ${qa.timestamp}`);
                form.push("");
            });
        } else {
            form.push("   No situation discovery data available.");
            form.push("");
        }

        form.push("🏠 LIFESTYLE DISCOVERY:");
        if (record.lifestyle_discovery && record.lifestyle_discovery.length > 0) {
            record.lifestyle_discovery.forEach((qa: any, index: number) => {
                form.push(`   ${index + 1}. Q: ${qa.question}`);
                form.push(`      A: ${qa.answer}`);
                // form.push(`      📅 ${qa.timestamp}`);
                form.push("");
            });
        } else {
            form.push("   No lifestyle discovery data available.");
            form.push("");
        }

        form.push("🎯 READINESS DISCOVERY:");
        if (record.readiness_discovery && record.readiness_discovery.length > 0) {
            record.readiness_discovery.forEach((qa: any, index: number) => {
                form.push(`   ${index + 1}. Q: ${qa.question}`);
                form.push(`      A: ${qa.answer}`);
                // form.push(`      📅 ${qa.timestamp}`);
                form.push("");
            });
        } else {
            form.push("   No readiness discovery data available.");
            form.push("");
        }

        form.push("⭐ PRIORITIES DISCOVERY:");
        if (record.priorities_discovery && record.priorities_discovery.length > 0) {
            record.priorities_discovery.forEach((qa: any, index: number) => {
                form.push(`   ${index + 1}. Q: ${qa.question}`);
                form.push(`      A: ${qa.answer}`);
                // form.push(`      📅 ${qa.timestamp}`);
                form.push("");
            });
        } else {
            form.push("   No priorities discovery data available.");
            form.push("");
        }

        form.push("📅 VISIT SCHEDULING:");
        if (record.visit_scheduling && record.visit_scheduling.length > 0) {
            record.visit_scheduling.forEach((qa: any, index: number) => {
                form.push(`   ${index + 1}. Q: ${qa.question}`);
                form.push(`      A: ${qa.answer}`);
                // form.push(`      📅 ${qa.timestamp}`);  
                form.push("");
            });
        } else {
            form.push("   No visit scheduling data available.");
            form.push("");
        }

        form.push("📊 SUMMARY:");
        form.push(`   Total Q&A Entries: ${this.getTotalQAEntries(record)}`);
        form.push(`   Last Updated: ${record.last_updated || "Not available"}`);
        form.push("");
        form.push("=== END OF COMPREHENSIVE RECORDS ===");

        return form.join("\n");
    }

    /**
     * Get total number of Q&A entries across all sections
     */
    private static getTotalQAEntries(record: any): number {
        let total = 0;
        if (record.situation_discovery) total += record.situation_discovery.length;
        if (record.lifestyle_discovery) total += record.lifestyle_discovery.length;
        if (record.readiness_discovery) total += record.readiness_discovery.length;
        if (record.priorities_discovery) total += record.priorities_discovery.length;
        if (record.visit_scheduling) total += record.visit_scheduling.length;
        return total;
    }

    /**
     * Send a simple notification email
     * @param toEmail - Recipient email address  
     * @param message - Simple message content
     */
    static async sendNotification(toEmail: string, message: string): Promise<boolean> {
        return this.sendEmail(toEmail, "Grand Villa Discovery Notification", message);
    }
}
