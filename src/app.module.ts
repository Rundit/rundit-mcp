import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RunditModule } from './rundit/rundit.module.js';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), RunditModule],
})
export class AppModule {}
