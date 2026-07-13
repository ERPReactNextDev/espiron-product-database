"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useUser } from "@/contexts/UserContext";
import { useRoleAccess, AccessKey } from "@/contexts/RoleAccessContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useWallpaper } from "@/contexts/WallpaperContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ChevronDown, ChevronUp, Search, ChevronLeft, ChevronRight, User, Building, Shield } from "lucide-react";

interface User {
  _id: string;
  Name?: string;
  Firstname?: string;
  Lastname?: string;
  Email: string;
  Department: string;
  Role: string;
  ReferenceID?: string;
  profilePicture?: string;
}

interface UserWithAccess extends User {
  access: Record<AccessKey, boolean>;
  isEditable: boolean;
}

export default function RolesPage() {
  const router = useRouter();
  const { userId: currentUserId } = useUser();
  const { toggleAccess, getUserAccess } = useRoleAccess();
  const { theme } = useTheme();
  const { wallpaper } = useWallpaper();
  const isEngineer = theme === "engineer";

  const [users, setUsers] = useState<UserWithAccess[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedUsers, setExpandedUsers] = useState<Set<string>>(new Set());
  const [accessDenied, setAccessDenied] = useState(false);
  const [loadingToggles, setLoadingToggles] = useState<Record<string, boolean>>({});
  const [currentUserData, setCurrentUserData] = useState<User | null>(null);

  const itemsPerPage = 10;

  const accessKeys: AccessKey[] = [
    "page:requests",
    "page:products",
    "page:suppliers",
    "page:roles",
    "page:add-product",
    "page:edit-product",
    "feature:approval-bypass",
  ];

  const accessKeyLabels: Record<string, string> = {
    "page:requests": "Requests Page",
    "page:products": "Products Page",
    "page:suppliers": "Suppliers Page",
    "page:roles": "Roles Page",
    "page:add-product": "Add Product Page",
    "page:edit-product": "Edit Product Page",
    "feature:approval-bypass": "Bypass For Approval",
  };

  const getDisplayName = (user: User) => {
    const first = user.Firstname?.trim() ?? "";
    const last = user.Lastname?.trim() ?? "";
    const fullName = `${first} ${last}`.trim();
    if (fullName) return fullName;
    if (user.Name?.trim()) return user.Name.trim();
    return user.Email || "Unknown User";
  };

  const getNameInitials = (name: string) => {
    const words = name.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) return "U";
    if (words.length === 1) return words[0].charAt(0).toUpperCase();
    return `${words[0].charAt(0)}${words[1].charAt(0)}`.toUpperCase();
  };

  useEffect(() => {
    if (!currentUserId) {
      router.push("/login");
      return;
    }

    const fetchCurrentUserData = async () => {
      try {
        const res = await fetch(`/api/users?id=${encodeURIComponent(currentUserId)}`);
        if (!res.ok) return;
        const userData = await res.json();

        const isEngineeringManager =
          userData.Department === "Engineering" && userData.Role === "Manager";
        const isITDepartment = userData.Department === "IT";

        if (!isEngineeringManager && !isITDepartment) {
          setAccessDenied(true);
          setLoading(false);
          return;
        }

        setCurrentUserData(userData);
        await fetchEngineeringUsers(userData);
      } catch (error) {
        console.error("Error fetching current user data:", error);
        setLoading(false);
      }
    };

    const fetchEngineeringUsers = async (currentUser: User | null) => {
      try {
        const res = await fetch(`/api/users?list=engineering-it&viewerId=${currentUserId}`);
        if (!res.ok) return;
        const usersData: User[] = await res.json();

        const usersWithAccess = await Promise.all(
          usersData
          .filter((user) => {
            // Backend handles filtering, just ensure valid departments
            return user.Department === "Engineering" || user.Department === "IT";//
          })
            .map(async (user) => {
              const access = await getUserAccess(user._id);
              return {
                ...user,
                access: access || {},
                isEditable: true,
              };
            })
        );

        setUsers(usersWithAccess);
      } catch (error) {
        console.error("Error fetching engineering users:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchCurrentUserData();
  }, [currentUserId, router, getUserAccess]);

  const searchedUsers = useMemo(() => {
    if (!searchTerm.trim()) return users;
    const lower = searchTerm.toLowerCase();
    return users.filter(
      (user) =>
        getDisplayName(user).toLowerCase().includes(lower) ||
        user.Firstname?.toLowerCase().includes(lower) ||
        user.Lastname?.toLowerCase().includes(lower) ||
        user.Name?.toLowerCase().includes(lower) ||
        user.Email?.toLowerCase().includes(lower) ||
        user.Department?.toLowerCase().includes(lower) ||
        user.Role?.toLowerCase().includes(lower)
    );
  }, [searchTerm, users]);

  const totalPages = Math.max(1, Math.ceil(searchedUsers.length / itemsPerPage));

  const paginatedUsers = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return searchedUsers.slice(start, start + itemsPerPage);
  }, [searchedUsers, currentPage, itemsPerPage]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [totalPages, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const toggleUserExpansion = (userId: string) => {
    const newExpanded = new Set(expandedUsers);
    if (newExpanded.has(userId)) {
      newExpanded.delete(userId);
    } else {
      newExpanded.add(userId);
    }
    setExpandedUsers(newExpanded);
  };

  const handleToggleAccess = async (userId: string, key: AccessKey, value: boolean) => {
    const toggleId = `${userId}-${key}`;
    setLoadingToggles((prev) => ({ ...prev, [toggleId]: true }));
    try {
      await toggleAccess(userId, key, value);
      setUsers((prevUsers) =>
        prevUsers.map((user) =>
          user._id === userId
            ? { ...user, access: { ...user.access, [key]: value } }
            : user
        )
      );
    } catch (error) {
      console.error("Error toggling access:", error);
    } finally {
      setLoadingToggles((prev) => ({ ...prev, [toggleId]: false }));
    }
  };

  if (accessDenied) {
    return (
      <div className="h-dvh flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md mx-4">
          <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Shield className="w-8 h-8 text-red-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Access Denied</h2>
            <p className="text-gray-600 mb-4">
              You do not have permission to access the Roles page. Only Engineering Managers and IT
              department staff can view this page.
            </p>
            <Button onClick={() => router.push("/dashboard")} className="w-full">
              Return to Dashboard
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-dvh flex flex-col overflow-hidden bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b p-4 md:p-6">
        {/* Mobile: Title on top, search below */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <SidebarTrigger />
            <h1 className="text-xl md:text-2xl font-semibold">User Access Management</h1>
          </div>
          <div className="relative w-full md:w-auto">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search users..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 w-full md:w-64"
            />
          </div>
        </div>

        {/* Mobile: Stack description and pagination */}
        <div className="mt-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <p className="text-sm text-gray-600">
            Manage access permissions for Engineering and IT users (bypass lets them skip For Approval on changes)
          </p>
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <span>{searchedUsers.length} users</span>
            {totalPages > 1 && (
              <div className="flex items-center gap-2">
                <button
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((p) => p - 1)}
                  className="h-8 w-8 rounded border flex items-center justify-center disabled:opacity-40"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="text-sm font-medium">
                  {currentPage} / {totalPages}
                </span>
                <button
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage((p) => p + 1)}
                  className="h-8 w-8 rounded border flex items-center justify-center disabled:opacity-40"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className={`flex-1 overflow-y-auto p-3 md:p-6 ${isEngineer && !wallpaper ? "engineer-blueprint-bg" : ""}`}>
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="h-8 w-8 rounded-full border-2 border-gray-200 border-t-gray-800 animate-spin" />
          </div>
        ) : (
          <div className="space-y-4">
            {paginatedUsers.length === 0 ? (
              <div className="text-center py-12">
                <User className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-600">No users found</p>
                <p className="text-sm text-gray-400 mt-1">
                  {searchTerm ? "Try adjusting your search" : "No Engineering or IT users found"}
                </p>
              </div>
            ) : (
              paginatedUsers.map((user) => (
                <Card key={user._id} className="overflow-hidden">
                  <CardHeader
                    className="cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors p-4 md:p-6"
                    onClick={() => toggleUserExpansion(user._id)}
                  >
                    {/* Mobile: Stack layout, Desktop: Row layout */}
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10 rounded-full shrink-0">
                          <AvatarImage src={user.profilePicture || ""} alt={getDisplayName(user)} />
                          <AvatarFallback className="bg-blue-100 text-blue-700">
                            {getNameInitials(getDisplayName(user))}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <CardTitle className="text-base md:text-lg capitalize truncate">{getDisplayName(user)}</CardTitle>
                          <p className="text-xs md:text-sm text-gray-600 truncate">{user.Email}</p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between md:justify-end gap-2 md:gap-4">
                        <div className="text-xs md:text-sm text-gray-500">
                          <Building className="h-4 w-4 inline mr-1" />
                          {user.Department} • {user.Role}
                        </div>
                        {expandedUsers.has(user._id) ? (
                          <ChevronUp className="h-5 w-5 text-gray-400 shrink-0" />
                        ) : (
                          <ChevronDown className="h-5 w-5 text-gray-400 shrink-0" />
                        )}
                      </div>
                    </div>
                  </CardHeader>

                  {expandedUsers.has(user._id) && (
                    <CardContent className="pt-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {accessKeys.map((key) => {
                          const toggleId = `${user._id}-${key}`;
                          const isLoading = loadingToggles[toggleId];
                          const isChecked = user.access[key] ?? true;

                          return (
                            <div
                              key={key}
                              className={`flex items-center justify-between p-3 border rounded-lg transition-colors ${
                                user.isEditable ? "cursor-pointer hover:bg-gray-50" : ""
                              }`}
                              onClick={() => {
                                if (user.isEditable && !isLoading) {
                                  handleToggleAccess(user._id, key, !isChecked);
                                }
                              }}
                            >
                              <div>
                                <p className="font-medium text-sm">{accessKeyLabels[key]}</p>
                                <p className="text-xs text-gray-500">{key}</p>
                              </div>
                              <div className="flex items-center gap-2">
                                {!user.isEditable ? (
                                  <Shield className="h-4 w-4 text-green-600" />
                                ) : isLoading ? (
                                  <div className="h-4 w-4 rounded-full border-2 border-gray-300 border-t-blue-600 animate-spin" />
                                ) : (
                                  <Switch
                                    checked={isChecked}
                                    onCheckedChange={(checked) =>
                                      handleToggleAccess(user._id, key, checked)
                                    }
                                    disabled={!user.isEditable || isLoading}
                                    className="data-[state=checked]:bg-green-600 data-[state=unchecked]:bg-gray-300"
                                  />
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {!user.isEditable && (
                        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                          <p className="text-sm text-blue-800 flex items-center gap-2">
                            <Shield className="h-4 w-4" />
                            This user has full access and cannot be modified
                          </p>
                        </div>
                      )}
                    </CardContent>
                  )}
                </Card>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}