import { computed } from 'vue'
import { clearSession, currentUser, setUserInfo, TOKEN_KEY } from './auth'
import { updateUserProfile } from '../api/user'
import type { CurrentUser, UserProfile } from '../api/types'
import { RequestError } from '../utils/request'

export type { UserProfile } from '../api/types'

export class ProfileError extends Error {
  constructor(
    message: string,
    public status = 0
  ) {
    super(message)
  }
}

export const userProfile = computed<UserProfile>(() => ({
  name: currentUser.value?.name || currentUser.value?.username || '',
  email: currentUser.value?.email || '',
  location: currentUser.value?.location || '',
  website: currentUser.value?.website || '',
  bio: currentUser.value?.bio || '',
  avatar: currentUser.value?.avatar || '',
  phone: currentUser.value?.phone || '',
  about: currentUser.value?.about || '',
  skills: [...(currentUser.value?.skills || [])],
  workExperiences: (currentUser.value?.workExperiences || []).map(item => ({ ...item }))
}))

export function cloneUserProfile(profile: UserProfile): UserProfile {
  return {
    ...profile,
    skills: [...profile.skills],
    workExperiences: profile.workExperiences.map(item => ({ ...item }))
  }
}

export async function saveUserProfile(profile: UserProfile) {
  const userId = currentUser.value?.id
  const token = localStorage.getItem(TOKEN_KEY)
  if (!userId || !token) throw new ProfileError('登录已过期，请重新登录。', 401)
  const sameSession = () =>
    currentUser.value?.id === userId && localStorage.getItem(TOKEN_KEY) === token
  const fields = [
    'name',
    'email',
    'location',
    'website',
    'bio',
    'avatar',
    'phone',
    'about'
  ] as const
  const body = {
    ...Object.fromEntries(fields.map(field => [field, profile[field].trim()])),
    skills: [...new Set(profile.skills.map(skill => skill.trim()).filter(Boolean))],
    workExperiences: profile.workExperiences.map(item => ({
      id: item.id.trim(),
      company: item.company.trim(),
      position: item.position.trim(),
      startDate: item.startDate,
      endDate: item.endDate,
      description: item.description.trim()
    }))
  } as UserProfile
  let data: CurrentUser
  try {
    data = await updateUserProfile(body)
  } catch (error) {
    if (error instanceof RequestError) {
      if (error.status === 401) {
        if (!sameSession()) throw new ProfileError('登录状态已变化，请重新打开个人资料页。')
        clearSession()
      }
      throw new ProfileError(error.message, error.status)
    }
    throw new ProfileError('暂时无法连接服务，请检查网络后重试。')
  }
  if (!data || data.id !== userId) throw new ProfileError('服务返回的资料不正确，请刷新后重试。')
  // A late response must not replace another account or a newer login session.
  if (!sameSession()) throw new ProfileError('登录状态已变化，请重新打开个人资料页。')
  setUserInfo(data as CurrentUser)
  return userProfile.value
}
