import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router-dom'
import { z } from 'zod'
import { Alert } from '@/shared/ui/Alert'
import { Badge } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'
import { Input } from '@/shared/ui/Input'
import { Select } from '@/shared/ui/Select'
import { Skeleton } from '@/shared/ui/Skeleton'
import { Textarea } from '@/shared/ui/Textarea'
import { useCreateRoom } from '../application/useCreateRoom'
import { useRooms } from '../application/useRooms'
import type { CreateRoomInput, RoomRepositoryError } from '../domain/room.types'
import styles from './RoomSetupPage.module.css'

interface RoomFormValues {
  name: string
  bathroomType: '' | 'PRIVATE' | 'SHARED'
  furnished: 'yes' | 'no'
  description: string
}

const FORM_DEFAULTS: RoomFormValues = { name: '', bathroomType: '', furnished: 'no', description: '' }

/**
 * /properties/:propertyId/rooms/setup - configures one or more rooms after
 * creating a BY_ROOMS property. Deliberately does not fetch the Property
 * itself (no getById): propertyId from the URL plus create_room_asset's own
 * server-side validation (property exists, is BY_ROOMS, management access)
 * are enough for this page to function correctly.
 *
 * "Terminar configuración" is gated on useRooms(propertyId) - the real,
 * backend-confirmed room count - not on navigation state or a local
 * session-only list. This works identically whether the visitor arrived
 * from creating the property, typed the URL directly, or refreshed: the
 * rooms table (RLS-protected) is the single authority.
 */
export default function RoomSetupPage() {
  const { t } = useTranslation('properties')
  const { propertyId } = useParams<{ propertyId: string }>()
  const navigate = useNavigate()
  const createRoom = useCreateRoom()
  const roomsQuery = useRooms(propertyId)

  const schema = z.object({
    name: z.string().min(1, t('rooms.validation.nameRequired')),
    bathroomType: z.enum(['', 'PRIVATE', 'SHARED']),
    furnished: z.enum(['yes', 'no']),
    description: z.string(),
  })

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<RoomFormValues>({ resolver: zodResolver(schema), defaultValues: FORM_DEFAULTS })

  if (!propertyId) {
    return (
      <div className={styles['page']}>
        <Alert tone="danger">{t('rooms.errors.missingProperty')}</Alert>
      </div>
    )
  }

  const rooms = roomsQuery.data ?? []
  const canFinish = !roomsQuery.isLoading && !roomsQuery.isError && rooms.length >= 1
  // roomRepository.createForProperty only ever rejects with a
  // RoomRepositoryError (see useCreateRoom's own doc comment for why TError
  // isn't spelled out at the mutation level).
  const createRoomError = createRoom.error as RoomRepositoryError | null
  const createErrorKey =
    createRoomError?.code === 'duplicate_name' ? 'rooms.errors.duplicateName' : 'rooms.errors.createFailed'

  const onSubmit = handleSubmit((values) => {
    const input: CreateRoomInput = {
      propertyId,
      name: values.name,
      bathroomType: values.bathroomType === '' ? null : values.bathroomType,
      furnished: values.furnished === 'yes',
      description: values.description.trim() === '' ? null : values.description,
    }

    createRoom.mutate(input, {
      onSuccess: () => {
        reset(FORM_DEFAULTS)
      },
    })
  })

  return (
    <div className={styles['page']}>
      <h1 className="text-h2">{t('rooms.setupTitle')}</h1>
      <p className="text-body-sm text-muted">{t('rooms.setupDescription')}</p>

      {createRoom.isError ? <Alert tone="danger">{t(createErrorKey)}</Alert> : null}

      <form
        onSubmit={(event) => {
          void onSubmit(event)
        }}
        noValidate
        className={styles['form']}
      >
        <Input
          label={t('rooms.name.label')}
          error={errors.name?.message}
          disabled={createRoom.isPending}
          {...register('name')}
        />
        <Select label={t('rooms.bathroomType.label')} disabled={createRoom.isPending} {...register('bathroomType')}>
          <option value="">{t('rooms.bathroomType.unspecified')}</option>
          <option value="PRIVATE">{t('rooms.bathroomType.PRIVATE')}</option>
          <option value="SHARED">{t('rooms.bathroomType.SHARED')}</option>
        </Select>
        <Select label={t('rooms.furnished.label')} disabled={createRoom.isPending} {...register('furnished')}>
          <option value="no">{t('rooms.furnished.no')}</option>
          <option value="yes">{t('rooms.furnished.yes')}</option>
        </Select>
        <Textarea label={t('rooms.description.label')} disabled={createRoom.isPending} {...register('description')} />
        <Button type="submit" loading={createRoom.isPending} className={styles['submit']}>
          {createRoom.isPending ? t('rooms.submitting') : t('rooms.submit')}
        </Button>
      </form>

      {roomsQuery.isLoading ? (
        <div data-testid="rooms-loading">
          <Skeleton height={20} width={160} />
          <Skeleton height={44} radius="md" />
        </div>
      ) : roomsQuery.isError ? (
        <Alert tone="danger">{t('rooms.errors.listFailed')}</Alert>
      ) : (
        <div>
          <h2 className="text-h3">{t('rooms.addedTitle')}</h2>
          {rooms.length === 0 ? (
            <p className="text-body-sm text-muted">{t('rooms.noneYet')}</p>
          ) : (
            <ul className={styles['roomList']}>
              {rooms.map((room) => (
                <li key={room.id} className={styles['roomItem']}>
                  <span>{room.name}</span>
                  {room.bathroomType ? (
                    <Badge tone="neutral">{t(`rooms.bathroomType.${room.bathroomType}`)}</Badge>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className={styles['finishRow']}>
        <Button
          type="button"
          variant="secondary"
          disabled={!canFinish}
          onClick={() => {
            void navigate('/properties')
          }}
        >
          {t('rooms.finish')}
        </Button>
        {!canFinish ? (
          <p className="text-caption text-muted">
            {roomsQuery.isLoading ? t('rooms.loadingHint') : t('rooms.finishDisabledHint')}
          </p>
        ) : null}
      </div>
    </div>
  )
}
