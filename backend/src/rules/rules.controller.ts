import {
  Controller,
  Get,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
} from "@nestjs/common";
import { RulesService } from "./rules.service";
import { ReplaceRulesDto, RuleResponseDto } from "./dto/rule.dto";
import { AuthGuard } from "../auth/guards/auth.guard";

@Controller("rules")
@UseGuards(AuthGuard)
export class RulesController {
  constructor(private readonly rulesService: RulesService) {}

  @Get()
  findAll(@Query("exerciseId") exerciseId: string): Promise<RuleResponseDto[]> {
    return this.rulesService.findByExercise(exerciseId);
  }

  @Put(":exerciseId")
  replace(
    @Param("exerciseId") exerciseId: string,
    @Body() body: ReplaceRulesDto,
  ): Promise<RuleResponseDto[]> {
    return this.rulesService.replace(exerciseId, body.rules);
  }
}
