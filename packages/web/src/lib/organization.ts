import { Crown, Shield, User } from "@lucide/svelte";

export const roles = [
  {
    value: "owner",
    label: "Owner",
    icon: Crown,
    description: "Full access to everything",
  },
  {
    value: "admin",
    label: "Admin",
    icon: Shield,
    description: "Can manage Q&A and settings",
  },
  {
    value: "member",
    label: "Member",
    icon: User,
    description: "Can view Q&A and settings",
  },
] as const;

export const getRoleInfo = (role: string) =>
  roles.find((r) => r.value === role) || roles[2];

export const getRoleColor = (role: string) => {
  switch (role) {
    case "owner":
      return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300";
    case "admin":
      return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300";
    default:
      return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300";
  }
};
