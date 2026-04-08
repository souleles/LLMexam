export class StudentResponseDto {
  id: string;
  studentIdentifier: string;
  firstName: string;
  lastName: string;
  email: string | null;
  miniReport: string | null;
  miniReportAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
