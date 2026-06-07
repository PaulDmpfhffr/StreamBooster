import { Test } from '@nestjs/testing';
import { AuthService } from '../auth.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { getRedisConnectionToken } from '@nestjs-modules/ioredis';
import * as bcrypt from 'bcrypt';

const mockPrisma = {
  user: {
    findUnique: jest.fn(),
    create: jest.fn(),
  },
};

const mockJwt = { sign: jest.fn(() => 'token') };
const mockConfig = { get: jest.fn((key) => key) };
const mockRedis = { exists: jest.fn(), set: jest.fn() };

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: JwtService, useValue: mockJwt },
        { provide: ConfigService, useValue: mockConfig },
        { provide: getRedisConnectionToken(), useValue: mockRedis },
      ],
    }).compile();

    service = module.get(AuthService);
    jest.clearAllMocks();
    mockRedis.exists.mockResolvedValue(0);
    mockRedis.set.mockResolvedValue('OK');
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

  describe('refresh', () => {
    const fakeToken = 'refresh.token.value';
    const fakeUser = { id: 'uuid-1', email: 'user@test.com', role: 'user', passwordHash: 'hash' };

    it('retourne une nouvelle paire de tokens et blackliste l\'ancien token', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(fakeUser);
      const result = await service.refresh('uuid-1', fakeToken);
      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(mockRedis.set).toHaveBeenCalledTimes(1);
    });

    it('lève UnauthorizedException si le token est déjà blacklisté (replay attack)', async () => {
      mockRedis.exists.mockResolvedValue(1);
      await expect(service.refresh('uuid-1', fakeToken)).rejects.toThrow(UnauthorizedException);
      expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
    });

    it('lève UnauthorizedException si l\'utilisateur n\'existe plus', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      await expect(service.refresh('uuid-gone', fakeToken)).rejects.toThrow(UnauthorizedException);
    });
  });
});
