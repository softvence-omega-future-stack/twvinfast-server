import { Injectable } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';

@Injectable()
export class BusinessService {
  constructor(private prisma: PrismaService) {}

  // ✔ Get Company Profile
  async getBusiness(businessId: number) {
    return this.prisma.business.findUnique({
      where: { id: businessId },
    });
  }

  // ✔ Update Company Profile
  async updateBusiness(businessId: number, data: any) {
    return this.prisma.business.update({
      where: { id: businessId },
      data,
    });
  }

  // ✔ Get Knowledge Base Documents
  async getKnowledgeBase(businessId: number) {
    return this.prisma.aiTrainingData.findMany({
      where: { business_id: businessId },
      orderBy: { created_at: 'desc' },
    });
  }

  // ✔ Get Customers
  async getCustomers(businessId: number) {
    return this.prisma.customer.findMany({
      where: { business_id: businessId },
      include: {
        threads: true,
        opportunities: true,
      },
    });
  }

  // ✔ Get Email History for a Customer
  async getCustomerEmailHistory(customerId: number) {
    return this.prisma.emailThread.findMany({
      where: { customer_id: customerId },
      orderBy: { last_message_at: 'desc' },
    });
  }

  // ✔ Get Integrations
  async getIntegrations(businessId: number) {
    return this.prisma.integration.findMany({
      where: { business_id: businessId },
    });
  }
}
