import { BadRequestException, Injectable } from '@nestjs/common';
import * as XLSX from 'xlsx';
import { PrismaService } from '../prisma/prisma.service';
import { StudentResponseDto } from './dto/student.dto';

interface StudentRow {
  AM: string;
  firstName: string;
  lastName: string;
  email?: string;
}

@Injectable()
export class StudentsService {
  constructor(private readonly prisma: PrismaService) {}

  async importFromFile(file: Express.Multer.File): Promise<StudentResponseDto[]> {
    let rows: StudentRow[];

    try {
      const workbook = XLSX.read(file.buffer, { type: 'buffer' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
      rows = this.parseRows(raw);
    } catch (error) {
      throw new BadRequestException(`Failed to parse file: ${error.message}`);
    }

    if (rows.length === 0) {
      throw new BadRequestException('No valid rows found in file');
    }

    // Upsert all students
    await this.prisma.$transaction(
      rows.map((row) =>
        this.prisma.student.upsert({
          where: { studentIdentifier: row.AM },
          create: {
            studentIdentifier: row.AM,
            firstName: row.firstName,
            lastName: row.lastName,
            email: row.email || null,
          },
          update: {
            firstName: row.firstName,
            lastName: row.lastName,
            email: row.email || null,
          },
        }),
      ),
    );

    return this.findAll();
  }

  async findAll(): Promise<StudentResponseDto[]> {
    return this.prisma.student.findMany({
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });
  }

  private parseRows(raw: Record<string, unknown>[]): StudentRow[] {
    return raw
      .map((row) => {
        const am = String(row['AM'] ?? row['am'] ?? '').trim();
        const firstName = String(row['firstName'] ?? row['firstname'] ?? row['FirstName'] ?? row['first_name'] ?? '').trim();
        const lastName = String(row['lastName'] ?? row['lastname'] ?? row['LastName'] ?? row['last_name'] ?? '').trim();
        const email = String(row['email'] ?? row['Email'] ?? '').trim() || undefined;

        return { AM: am, firstName, lastName, email };
      })
      .filter((r) => r.AM && r.firstName && r.lastName);
  }
}
