import { Role } from 'src/generated/prisma/enums';

export type CreateCustomerData = {
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  birthDate: Date;
  address: string;
};

export type UserProfile = {
  id: string;
  email: string;
  role: Role;
  firstName: string | null;
  lastName: string | null;
};
