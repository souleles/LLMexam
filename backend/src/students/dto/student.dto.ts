export class StudentResponseDto {
  id: string;
  studentIdentifier: string;
  firstName: string;
  lastName: string;
  email: string | null;
  createdAt: Date;
  updatedAt: Date;
}
