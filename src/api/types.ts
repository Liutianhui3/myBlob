export interface WorkExperience {
  id: string
  company: string
  position: string
  startDate: string
  endDate: string
  description: string
}

export interface CurrentUser {
  isAdmin?: boolean
  id: string
  username: string | null
  name: string
  email: string
  location?: string
  website?: string
  bio?: string
  avatar?: string
  phone?: string
  about?: string
  skills?: string[]
  workExperiences?: WorkExperience[]
  createdAt?: string
  updatedAt?: string
}

export interface UserProfile {
  name: string
  email: string
  location: string
  website: string
  bio: string
  avatar: string
  phone: string
  about: string
  skills: string[]
  workExperiences: WorkExperience[]
}
