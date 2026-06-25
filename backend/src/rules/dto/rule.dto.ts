import { IsArray, IsString } from "class-validator";

export class ReplaceRulesDto {
  @IsArray()
  @IsString({ each: true })
  rules: string[];
}

export class RuleResponseDto {
  id: string;
  exerciseId: string;
  content: string;
  order: number;
  createdAt: Date;
}
