import { Test } from '@nestjs/testing';
import { AuthService } from '../auth.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import * as bcrypt from 'bcrypt';

const mockPrisma = {
  user: {
    findUnique: jest.fn(),
    create: jest.fn(),
  },
};

const mockJwt = { sign: jest.fn(() => 'token') };
const mockConfig = { get: jest.fn((key: string) => key) };

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: JwtService, useValue: mockJwt },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();

    service = module.get(AuthService);
    jest.clearAllMocks();
  });

  describe('register', () => {
    it('crée un utilisateur et retourne les tokens', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue({
        id: 'uuid-1',
        email: 'test@test.com',
        role: 'user',
        passwordHash: 'hash',
      });

      const result = await service.register('test@test.com', 'password123');
      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(mockPrisma.user.create).toHaveBeenCalledTimes(1);
    });

    it('lève ConflictException si l\'email existe déjà', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'existing' });
      await expect(service.register('existing@test.com', 'pass')).rejects.toThrow(ConflictException);
    });
  });

  describe('login', () => {
    it('retourne les tokens avec des credentials valides', async () => {
      const hash = await bcrypt.hash('correctpassword', 12);
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'uuid-1',
        email: 'user@test.com',
        passwordHash: hash,
        role: 'user',
      });

      const result = await service.login('user@test.com', 'correctpassword');
      expect(result).toHaveProperty('accessToken');
    });

    it('lève UnauthorizedException si l\'utilisateur n\'existe pas', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      await expect(service.login('unknown@test.com', 'pass')).rejects.toThrow(UnauthorizedException);
    });

    it('lève UnauthorizedException si le mot de passe est incorrect', async () => {
      const hash = await bcrypt.hash('correctpassword', 12);
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'uuid-1',
        passwordHash: hash,
        role: 'user',
      });
      await expect(service.login('user@test.com', 'wrongpassword')).rejects.toThrow(UnauthorizedException);
    });
  });
});
