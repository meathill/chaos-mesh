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
import { Box, Button, Grid, Grow, Modal, Stack, useTheme } from '@mui/material'
import { Confirm, setAlert, setConfirm } from 'slices/globalStatus'
import { Fragment, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { useStoreDispatch, useStoreSelector } from 'store'

import { Ace } from 'ace-builds'
import ArchiveOutlinedIcon from '@mui/icons-material/ArchiveOutlined'
import { Event } from 'api/events.type'
import { EventHandler } from 'cytoscape'
import EventsTimeline from 'components/EventsTimeline'
import FileCopyOutlinedIcon from '@mui/icons-material/FileCopyOutlined'
import MetaForm from 'components/NewWorkflow/MetaForm'
import NewExperimentNext from 'components/NewExperimentNext'
import NodeConfiguration from 'components/ObjectConfiguration/Node'
import Paper from '@ui/mui-extends/esm/Paper'
import PaperTop from '@ui/mui-extends/esm/PaperTop'
import PublishIcon from '@mui/icons-material/Publish'
import Space from '@ui/mui-extends/esm/Space'
import T from 'components/T'
import { WorkflowSingle } from 'api/workflows.type'
import _isEmpty from 'lodash.isempty'
import api from 'api'
import { constructWorkflowTopology } from 'lib/cytoscape'
import loadable from '@loadable/component'
import { makeStyles } from '@mui/styles'
import { useIntervalFetch } from 'lib/hooks'
import { useIntl } from 'react-intl'
import yaml from 'js-yaml'

const YAMLEditor = loadable(() => import('components/YAMLEditor'))

const useStyles = makeStyles((theme) => ({
  root: {},
  configPaper: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: '75vw',
    height: '90vh',
    padding: 0,
    transform: 'translate(-50%, -50%)',
    [theme.breakpoints.down('lg')]: {
      width: '90vw',
    },
  },
}))

const Single = () => {
  const classes = useStyles()
  const intl = useIntl()
  const navigate = useNavigate()
  const theme = useTheme()
  const { uuid } = useParams()
  const isCloneOrNew = /\/(clone|new2)$/.test(useLocation().pathname)

  const dispatch = useStoreDispatch()

  const [single, setSingle] = useState<WorkflowSingle>()
  const [data, setData] = useState<any>()
  const [selected, setSelected] = useState<'workflow' | 'node'>('workflow')
  const modalTitle = selected === 'workflow' ? single?.name : selected === 'node' ? data.name : ''
  const [configOpen, setConfigOpen] = useState(false)
  const topologyRef = useRef<any>(null)
  const [yamlEditor, setYAMLEditor] = useState<Ace.Editor>()

  const [events, setEvents] = useState<Event[]>([])

  const fetchWorkflowSingle = (intervalID?: number) => {
    if (!uuid) {
      clearInterval(intervalID)
      setSingle({
        is: 'workflow',
        uid: '',
        name: '',
        namespace: '',
        entry: 'entry',
        created_at: '',
        end_time: '',
        status: 'running',
        topology: {
          nodes: [
            {
              name: 'entry',
              state: 'unknown',
              template: 'entry',
              type: 'SerialNode',
              serial: [],
            },
          ],
        },
        kube_object: null,
      })
      return
    }

    api.workflows
      .single(uuid!)
      .then(({ data }) => {
        // TODO: remove noise in API
        data.kube_object.metadata.annotations &&
          delete data.kube_object.metadata.annotations['kubectl.kubernetes.io/last-applied-configuration']

        setSingle(data)

        // Clear interval after workflow succeed
        if (data.status === 'finished') {
          clearInterval(intervalID)
        }
      })
      .catch(console.error)
  }

  useIntervalFetch(fetchWorkflowSingle)

  useEffect(() => {
    if (single) {
      const topology = topologyRef.current!

      if (typeof topology === 'function') {
        topology(single)

        return
      }

      const { updateElements } = constructWorkflowTopology(topologyRef.current!, single, theme, handleNodeClick)

      topologyRef.current = updateElements
    }

    const fetchEvents = () => {
      api.events
        .cascadeFetchEventsForWorkflow(uuid!, { limit: 999 })
        .then(({ data }) => setEvents(data))
        .catch(console.error)
        .finally(() => {
          // setLoading(false)
        })
    }

    if (single && !isCloneOrNew) {
      fetchEvents()
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [single])

  const onModalOpen = () => setConfigOpen(true)
  const onModalClose = () => setConfigOpen(false)

  const handleSelect = (selected: Confirm) => () => dispatch(setConfirm(selected))

  const handleAction = (action: string) => () => {
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

          if (action === 'archive') {
            navigate('/workflows')
          }
        })
        .catch(console.error)
    }
  }

  const handleNodeClick: EventHandler = (e) => {
    const node = e.target
    const { id, template: nodeTemplate } = node.data()
    if (id === 'entry') {
      return
    }

    const template = single?.kube_object.spec.templates.find((t: any) => t.name === nodeTemplate)

    setData(template)
    setSelected('node')

    onModalOpen()
  }

  return (
    <>
      <Grow in={true} style={{ transformOrigin: '0 0 0' }}>
        <div>
          <Space spacing={6} className={classes.root}>
            <Space direction="row">
              {isCloneOrNew ? (
                <Button
                  type="submit"
                  variant="contained"
                  color="primary"
                  size="small"
                  startIcon={<PublishIcon />}
                  disabled={!single}
                >
                  {T('newW.submit')}
                </Button>
              ) : (
                <Fragment>
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<FileCopyOutlinedIcon />}
                    onClick={() => navigate(`/workflows/${uuid}/clone`)}
                  >
                    {T('common.copy')}
                  </Button>

                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<ArchiveOutlinedIcon />}
                    sx={{ marginLeft: 'auto' }}
                    onClick={handleSelect({
                      title: `${T('archives.single', intl)} ${single?.name}`,
                      description: T('workflows.deleteDesc', intl),
                      handle: handleAction('archive'),
                    })}
                  >
                    {T('archives.single')}
                  </Button>
                </Fragment>
              )}
            </Space>
            <Paper sx={{ display: 'flex', flexDirection: 'column', height: 450 }}>
              <PaperTop
                title={
                  <Space spacing={1.5} alignItems="center">
                    <Box>{T('workflow.topology')}</Box>
                  </Space>
                }
              ></PaperTop>
              <div ref={topologyRef} style={{ flex: 1 }} />
            </Paper>

            <Grid container>
              <Grid item xs={12} lg={6} sx={{ pr: 3 }}>
                {isCloneOrNew ? (
                  <MetaForm single={single} externalEditor={yamlEditor} submitable={true}></MetaForm>
                ) : (
                  <Paper sx={{ display: 'flex', flexDirection: 'column', height: 600 }}>
                    <PaperTop title={T('events.title')} boxProps={{ mb: 3 }} />
                    <Box flex={1} overflow="scroll">
                      <EventsTimeline events={events} />
                    </Box>
                  </Paper>
                )}
              </Grid>
              <Grid item xs={12} lg={6} sx={{ pl: 3 }}>
                <Paper sx={{ height: 600, p: 0 }}>
                  {single && (
                    <Space display="flex" flexDirection="column" height="100%">
                      <PaperTop title={T('common.definition')} boxProps={{ p: 4.5, pb: 0 }} />
                      <Box flex={1}>
                        <YAMLEditor
                          name={single.name}
                          data={yaml.dump({
                            apiVersion: 'chaos-mesh.org/v1alpha1',
                            kind: 'Workflow',
                            ...single.kube_object,
                          })}
                          mountEditor={setYAMLEditor}
                          download
                        />
                      </Box>
                    </Space>
                  )}
                </Paper>
              </Grid>
            </Grid>
          </Space>
        </div>
      </Grow>

      <Modal open={configOpen} onClose={onModalClose}>
        <div>
          <Paper
            className={classes.configPaper}
            sx={{ width: selected === 'workflow' ? '50vw' : selected === 'node' ? '70vw' : '50vw', overflow: 'auto' }}
          >
            {isCloneOrNew && (
              <Stack sx={{ p: 8 }}>
                <NewExperimentNext></NewExperimentNext>
              </Stack>
            )}
            {single && configOpen && !isCloneOrNew && (
              <Space display="flex" flexDirection="column" height="100%">
                <PaperTop title={modalTitle} boxProps={{ p: 4.5, pb: 0 }} />
                <Box display="flex" flex={1}>
                  {selected === 'node' && (
                    <Box width="50%">
                      <NodeConfiguration template={data} />
                    </Box>
                  )}
                  <YAMLEditor name={modalTitle} data={yaml.dump(data)} />
                </Box>
              </Space>
            )}
          </Paper>
        </div>
      </Modal>
    </>
  )
}

export default Single
