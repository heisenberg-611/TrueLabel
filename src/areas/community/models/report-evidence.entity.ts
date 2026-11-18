import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne,
  JoinColumn, CreateDateColumn,
} from 'typeorm';
import { FoodReport } from './food-report.entity';

// F13: Private storage metadata. Public URLs must never be stored in this table.
@Entity('report_evidence')
export class ReportEvidence {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  reportId: number;

  @ManyToOne(() => FoodReport, (report) => report.evidence, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'reportId' })
  report: FoodReport;

  @Column({ type: 'text' })
  filePath: string;

  @Column({ type: 'varchar', length: 32 })
  mimeType: string;

  @Column({ type: 'int' })
  byteSize: number;

  @CreateDateColumn()
  createdAt: Date;
}
