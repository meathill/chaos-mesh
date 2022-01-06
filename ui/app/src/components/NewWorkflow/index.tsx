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

import {
  Box,
  Button,
  Chip,
  Grid,
  IconButton,
  ListItemIcon,
  MenuItem,
  Step,
  StepLabel,
  Stepper,
  Typography,
} from '@mui/material'
import { Template, deleteTemplate } from 'slices/workflows'
import { setAlert, setConfirm } from 'slices/globalStatus'
import { useEffect, useState } from 'react'
import { useStoreDispatch, useStoreSelector } from 'store'

import Add from './Add'
import CheckIcon from '@mui/icons-material/Check'
import Menu from '@ui/mui-extends/esm/Menu'
import MetaForm from './MetaForm'
import Paper from '@ui/mui-extends/esm/Paper'
import RemoveIcon from '@mui/icons-material/Remove'
import Space from '@ui/mui-extends/esm/Space'
import T from 'components/T'
import UndoIcon from '@mui/icons-material/Undo'
import _isEmpty from 'lodash.isempty'
import { makeStyles } from '@mui/styles'
import { resetNewExperiment } from 'slices/experiments'
import { useIntl } from 'react-intl'

const useStyles = makeStyles((theme) => ({
  leftSticky: {
    position: 'sticky',
    top: 0,
    height: `calc(100vh - 56px - ${theme.spacing(9)})`,
  },
  field: {
    width: 180,
    marginTop: 0,
    [theme.breakpoints.up('sm')]: {
      marginBottom: 0,
    },
    '& .MuiInputBase-input': {
      padding: 8,
    },
    '& .MuiInputLabel-root, fieldset': {
      fontSize: theme.typography.body2.fontSize,
      lineHeight: 0.875,
    },
  },
}))

type IStep = Template

const NewWorkflow = () => {
  const classes = useStyles()
  const intl = useIntl()

  const state = useStoreSelector((state) => state)
  const { templates } = state.workflows
  const dispatch = useStoreDispatch()

  const [steps, setSteps] = useState<IStep[]>([])
  const [restoreIndex, setRestoreIndex] = useState(-1)

  useEffect(() => {
    return () => {
      dispatch(resetNewExperiment())
    }
  }, [dispatch])

  useEffect(() => {
    setSteps(_isEmpty(templates) ? [] : templates)
  }, [templates])

  const resetRestore = () => {
    setRestoreIndex(-1)
  }

  const restoreExperiment = (index: number) => () => {
    if (restoreIndex !== -1) {
      resetRestore()
    } else {
      setRestoreIndex(index)
    }
  }

  const removeExperiment = (index: number) => {
    dispatch(deleteTemplate(index))
    dispatch(
      setAlert({
        type: 'success',
        message: T('confirm.success.delete', intl) as string,
      })
    )
    resetRestore()
  }

  const handleSelect = (name: string, index: number, action: string) => () => {
    switch (action) {
      case 'delete':
        dispatch(
          setConfirm({
            index,
            title: `${T('common.delete', intl)} ${name}`,
            description: T('newW.node.deleteDesc', intl) as string,
            handle: handleAction(action, index),
          })
        )
        break
    }
  }

  const handleAction = (action: string, index: number) => () => {
    switch (action) {
      case 'delete':
        removeExperiment(index)
        break
    }
  }

  const updateTemplateCallback = () => {
    setRestoreIndex(-1)
    dispatch(resetNewExperiment())
  }

  return (
    <Grid container spacing={9}>
      <Grid item xs={12} md={8}>
        <Space spacing={6}>
          <Typography>{T('common.process')}</Typography>
          <Stepper orientation="vertical" sx={{ mt: -1, p: 0 }}>
            {steps.length > 0 &&
              steps.map((step, index) => (
                <Step key={step.name}>
                  {restoreIndex !== index ? (
                    <StepLabel icon={<CheckIcon sx={{ color: 'success.main' }} />}>
                      <Paper sx={{ p: 3, borderColor: 'success.main' }}>
                        <Box display="flex" justifyContent="space-between">
                          <Space direction="row" alignItems="center">
                            <Chip label={T(`newW.node.${step.type}`)} color="primary" size="small" />
                            <Typography component="div" variant="body1">
                              {step.name}
                            </Typography>
                          </Space>
                          <Space direction="row">
                            <IconButton size="small" title={T('common.edit', intl)} onClick={restoreExperiment(index)}>
                              <UndoIcon />
                            </IconButton>
                            <Menu>
                              <MenuItem dense onClick={handleSelect(step.name, index, 'delete')}>
                                <ListItemIcon>
                                  <RemoveIcon fontSize="small" />
                                </ListItemIcon>
                                <Typography variant="inherit">{T('common.delete')}</Typography>
                              </MenuItem>
                            </Menu>
                          </Space>
                        </Box>
                      </Paper>
                    </StepLabel>
                  ) : (
                    <Add externalTemplate={step} update={index} updateCallback={updateTemplateCallback} />
                  )}
                </Step>
              ))}
            {restoreIndex < 0 && (
              <Step>
                <Add />
              </Step>
            )}
          </Stepper>
        </Space>
      </Grid>
      <Grid item xs={12} md={4} className={classes.leftSticky}>
        <MetaForm preview={true}></MetaForm>
      </Grid>
    </Grid>
  )
}

export default NewWorkflow
