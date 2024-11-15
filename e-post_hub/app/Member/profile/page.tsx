'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardBody, CardHeader, Button, Input } from '@nextui-org/react';

// Define the type for AdminProfile with optional properties
// This ensures that TypeScript knows the structure of the admin profile object
type MemberProfile = {
  id: string;
  name: string;
  email: string;
  role: string;
};

//States to store data
export default function ProfilePage() {
  const [memberProfile, setMemberProfile] = useState<MemberProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Ensure that the code runs only in the client-side environment
    if (typeof window !== 'undefined') {
      // Fetch the current user's profile details from the API
      const fetchProfile = async () => {
        try {
          const token = localStorage.getItem('token');
          if (!token) {
            setError('No token found. Please log in.');
            setLoading(false);
            return;
          }

          //calls to api
          const response = await fetch('/api/members/profile', {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });

          if (response.ok) {
            const profileData = await response.json();
            if (profileData.role !== 'MEMBER') {
              // Redirect non-member users to a different page, like a "not authorized" page
              window.location.href = '/not-authorized';
              return;
            }
            setMemberProfile(profileData);
          } else {
            const errorResponse = await response.json();
            setError(`Failed to fetch profile: ${errorResponse.message}`);
          }
        } catch (error) {
          setError('An error occurred while fetching the profile');
        } finally {
          setLoading(false);
        }
      };

      fetchProfile();
    }
  }, []);

  if (loading) {
    return <div>Loading profile...</div>;
  }

  if (error) {
    return <div className="text-red-500">Error: {error}</div>;
  }

  return (
    <Card className="w-3/5 mx-auto my-10">
      <CardHeader className="flex flex-col items-center justify-center">
        <h2 className="text-3xl font-semibold">Member Profile</h2>
      </CardHeader>
      <CardBody className="space-y-6">
        <div className="flex flex-col gap-4 self-center">
            <p><strong>Name:</strong>     {memberProfile?.name}</p>
            <p><strong>Email:</strong>     {memberProfile?.email}</p>
        </div>

        <Button
          className="bg-orange-400 text-white mt-4"
          onClick={() => (window.location.href = '/Member')}
        >
          Back to Dashboard
        </Button>

        <Button
          className="bg-orange-400 text-white mt-4"
          onClick={() => (window.location.href = '')}
          isDisabled
        >
          Update Password
        </Button>

        <Button
          className="bg-orange-400 text-white mt-4"
          onClick={() => (window.location.href = '/Member/profile/edit')}
        >
          Edit Profile
        </Button>



      </CardBody>
    </Card>
  );
}