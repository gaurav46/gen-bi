import { Controller, Post, Body } from '@nestjs/common';
import { QueryService } from './query.service';
import type { QueryRequest } from './query.types';

@Controller('query')
export class QueryController {
  constructor(private readonly queryService: QueryService) {}

  @Post()
  query(@Body() body: QueryRequest) {
    return this.queryService.query(body);
  }
}
