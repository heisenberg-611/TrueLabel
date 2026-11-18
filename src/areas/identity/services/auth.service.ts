import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User, UserRole } from '../models/user.entity';
import { RegisterDto } from '../models/dto/register.dto';
import { LoginDto } from '../models/dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async register(registerDto: RegisterDto): Promise<Omit<User, 'passwordHash'>> {
    const existing = await this.userRepository.findOne({
      where: { email: registerDto.email.toLowerCase().trim() },
    });

    if (existing) {
      throw new ConflictException('An account with this email address already exists');
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(registerDto.password, salt);

    // Defense-in-depth: Ensure self-registration can never assign elevated roles
    const allowedRoles: UserRole[] = ['consumer', 'manufacturer'];
    const role: UserRole = allowedRoles.includes(registerDto.role) ? registerDto.role : 'consumer';

    const user = this.userRepository.create({
      name: registerDto.name.trim(),
      email: registerDto.email.toLowerCase().trim(),
      passwordHash,
      role,
      isVerified: true,
    });

    const saved = await this.userRepository.save(user);
    const { passwordHash: _, ...result } = saved;
    return result;
  }

  async validateUser(loginDto: LoginDto): Promise<Omit<User, 'passwordHash'>> {
    const user = await this.userRepository.findOne({
      where: { email: loginDto.email.toLowerCase().trim() },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const isMatch = await bcrypt.compare(loginDto.password, user.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const { passwordHash: _, ...result } = user;
    return result;
  }

  async findById(id: number): Promise<Omit<User, 'passwordHash'>> {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    const { passwordHash: _, ...result } = user;
    return result;
  }

  // Viva Demo Role Switcher: Resolve a real persisted database user so FK constraints (F11/F13/F16) always succeed.
  async findOrCreateDemoUser(role: UserRole): Promise<Omit<User, 'passwordHash'>> {
    const validRoles: UserRole[] = ['consumer', 'manufacturer', 'inspector', 'admin'];
    const chosenRole: UserRole = validRoles.includes(role) ? role : 'consumer';
    const demoEmail = `${chosenRole}@truelabel.demo`;

    let user =
      (await this.userRepository.findOne({ where: { email: demoEmail } })) ||
      (await this.userRepository.findOne({ where: { role: chosenRole }, order: { id: 'ASC' } }));

    if (!user) {
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash('password123', salt);
      user = await this.userRepository.save(
        this.userRepository.create({
          name: `Demo ${chosenRole.charAt(0).toUpperCase() + chosenRole.slice(1)}`,
          email: demoEmail,
          role: chosenRole,
          passwordHash,
          isVerified: true,
        }),
      );
    }

    const { passwordHash: _, ...result } = user;
    return result;
  }
}
