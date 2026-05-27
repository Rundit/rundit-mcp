import { Module } from '@nestjs/common';
import { RunditService } from './rundit.service.js';
import { RunditToolsService } from './rundit-tools.service.js';

@Module({
  providers: [RunditService, RunditToolsService],
})
export class RunditModule {}
