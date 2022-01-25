/*
 * Copyright 2021 Chaos Mesh Authors.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */
import { Confirm, setAlert, setConfirm } from 'slices/globalStatus'
import { IconButton, Table, TableBody, TableCell, TableContainer, TableHead, TableRow } from '@mui/material'
import { useStoreDispatch, useStoreSelector } from 'store'

import ArchiveOutlinedIcon from '@mui/icons-material/ArchiveOutlined'
import DateTime from 'lib/luxon'
import FileCopyOutlinedIcon from '@mui/icons-material/FileCopyOutlined'
import Paper from '@ui/mui-extends/esm/Paper'
import Space from '@ui/mui-extends/esm/Space'
import StatusLabel from 'components/StatusLabel'
import T from 'components/T'
import { Workflow } from 'api/workflows.type'
import api from 'api'
import { useIntl } from 'react-intl'
import { useNavigate } from 'react-router-dom'

interface DataTableProps {
  data: Workflow[]
  fetchData: () => void
}

const DataTable: React.FC<DataTableProps> = ({ data, fetchData }) => {
  const navigate = useNavigate()
  const intl = useIntl()

  const { lang } = useStoreSelector((state) => state.settings)
  const dispatch = useStoreDispatch()

  const handleJumpTo = (uuid: uuid) => () => navigate(`/workflows/${uuid}`)

  const handleSelect = (selected: Confirm) => (event: React.MouseEvent<HTMLSpanElement>) => {
    event.stopPropagation()

    dispatch(setConfirm(selected))
  }

  const handleClone = (uuid: string) => (event: React.MouseEvent<HTMLSpanElement>) => {
    event.stopPropagation()

    navigate(`/workflows/${uuid}/clone`)
  }

  const handleAction = (action: string, uuid: uuid) => () => {
    let actionFunc: any

    switch (action) {
      case 'archive':
        actionFunc = api.workflows.del

        break
      default:
        actionFunc = null
    }

    if (actionFunc) {
      actionFunc(uuid)
        .then(() => {
          dispatch(
            setAlert({
              type: 'success',
              message: T(`confirm.success.${action}`, intl),
            })
          )

          setTimeout(fetchData, 300)
        })
        .catch(console.error)
    }
  }

  return (
    <TableContainer component={(props) => <Paper {...props} sx={{ p: 0, borderBottom: 'none' }} />}>
      <Table stickyHeader>
        <TableHead>
          <TableRow>
            <TableCell>{T('common.name')}</TableCell>
            {/* <TableCell>{T('workflow.time')}</TableCell> */}
            <TableCell>{T('common.status')}</TableCell>
            <TableCell>{T('table.created')}</TableCell>
            <TableCell>{T('common.operation')}</TableCell>
          </TableRow>
        </TableHead>

        <TableBody>
          {data.map((d) => (
            <TableRow key={d.uid} hover sx={{ cursor: 'pointer' }} onClick={handleJumpTo(d.uid)}>
              <TableCell>{d.name}</TableCell>
              {/* <TableCell></TableCell> */}
              <TableCell>
                <StatusLabel status={d.status} />
              </TableCell>
              <TableCell>
                {DateTime.fromISO(d.created_at, {
                  locale: lang,
                }).toRelative()}
              </TableCell>
              <TableCell>
                <Space direction="row">
                  <IconButton
                    color="primary"
                    title={T('archives.single', intl)}
                    component="span"
                    size="small"
                    onClick={handleSelect({
                      title: `${T('archives.single', intl)} ${d.name}`,
                      description: T('workflows.deleteDesc', intl),
                      handle: handleAction('archive', d.uid),
                    })}
                  >
                    <ArchiveOutlinedIcon />
                  </IconButton>

                  <IconButton
                    color="success"
                    title={T('common.copy', intl)}
                    component="span"
                    size="small"
                    onClick={handleClone(d.uid)}
                  >
                    <FileCopyOutlinedIcon />
                  </IconButton>
                </Space>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  )
}

export default DataTable
