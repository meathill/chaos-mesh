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
import { Box, Button, Grow, Typography } from '@mui/material'

import AddIcon from '@mui/icons-material/Add'
import DataTable from './DataTable'
import Loading from '@ui/mui-extends/esm/Loading'
import NotFound from 'components/NotFound'
import T from 'components/T'
import { Workflow } from 'api/workflows.type'
import api from 'api'
import { comparator } from 'lib/luxon'
import { useIntervalFetch } from 'lib/hooks'
import { useNavigate } from 'react-router-dom'
import { useState } from 'react'

const Workflows = () => {
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [workflows, setWorkflows] = useState<Workflow[]>([])

  const fetchWorkflows = (intervalID?: number) => {
    api.workflows
      .workflows()
      .then(({ data }) => {
        setWorkflows(data.sort((a, b) => comparator(b.created_at, a.created_at)))

        if (data.every((d) => d.status === 'finished')) {
          clearInterval(intervalID)
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  useIntervalFetch(fetchWorkflows)

  return (
    <>
      <Grow in={!loading} style={{ transformOrigin: '0 0 0' }}>
        <div>
          <Box mb={6}>
            <Button variant="outlined" startIcon={<AddIcon />} onClick={() => navigate('/workflows/new')}>
              {T('newW.title')}
            </Button>
            <Button
              variant="outlined"
              startIcon={<AddIcon />}
              onClick={() => navigate('/workflows/new2')}
              sx={{ ml: 2 }}
            >
              {T('newW.title')} (hackthon)
            </Button>
          </Box>

          {workflows.length > 0 && <DataTable data={workflows} fetchData={fetchWorkflows} />}
        </div>
      </Grow>

      {!loading && workflows.length === 0 && (
        <NotFound illustrated textAlign="center">
          <Typography>{T('workflows.notFound')}</Typography>
        </NotFound>
      )}

      {loading && <Loading />}
    </>
  )
}

export default Workflows
