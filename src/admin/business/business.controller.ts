import { Controller, Get, Param, Patch, Body } from '@nestjs/common';
import { BusinessUpdateDto } from './dto/business-update.dto';
import { BusinessService } from './business.service';

@Controller('admin/business')
export class BusinessController {
  constructor(private businessService: BusinessService) {}

  // ✔ Company Profile
  @Get(':id')
  getBusiness(@Param('id') id: string) {
    return this.businessService.getBusiness(Number(id));
  }

  // ✔ Update Company Profile
  @Patch(':id')
  updateBusiness(@Param('id') id: string, @Body() dto: BusinessUpdateDto) {
    return this.businessService.updateBusiness(Number(id), dto);
  }

  // ✔ Knowledge Base
  @Get(':id/knowledge-base')
  getKnowledge(@Param('id') id: string) {
    return this.businessService.getKnowledgeBase(Number(id));
  }

  // ✔ Customers
  @Get(':id/customers')
  getCustomers(@Param('id') id: string) {
    return this.businessService.getCustomers(Number(id));
  }

  // ✔ Customer Email History
  @Get('customer/:customerId/email-history')
  getCustomerHistory(@Param('customerId') cid: string) {
    return this.businessService.getCustomerEmailHistory(Number(cid));
  }

  // ✔ Integrations
  @Get(':id/integrations')
  getIntegrations(@Param('id') id: string) {
    return this.businessService.getIntegrations(Number(id));
  }
}
