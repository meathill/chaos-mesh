import { Box, Button, MenuItem, Typography } from '@mui/material'
import { FC, Fragment, useEffect, useRef, useState } from 'react'
import { Form, Formik } from 'formik'
import { SelectField, TextField } from 'components/FormField'
import { constructWorkflow, validateDeadline, validateName } from 'lib/formikhelpers'
import { useStoreDispatch, useStoreSelector } from 'store'

import { Ace } from 'ace-builds'
import Paper from '@ui/mui-extends/esm/Paper'
import PublishIcon from '@mui/icons-material/Publish'
import Space from '@ui/mui-extends/esm/Space'
import T from 'components/T'
import { WorkflowSingle } from 'api/workflows.type'
import _isEmpty from 'lodash.isempty'
import api from 'api'
import loadable from '@loadable/component'
import { resetWorkflow } from 'slices/workflows'
import { useIntl } from 'react-intl'
import { useNavigate } from 'react-router-dom'
import yaml from 'js-yaml'

const YAMLEditor = loadable(() => import('components/YAMLEditor'))

interface MetaFormProps {
  preview?: boolean
  single?: WorkflowSingle
  externalEditor?: Ace.Editor
  submitable?: boolean
}

export type WorkflowBasic = {
  name: string
  namespace: string
  deadline: string
}

const MetaForm: FC<MetaFormProps> = ({ preview = false, single, externalEditor, submitable = false }) => {
  const intl = useIntl()

  const navigate = useNavigate()
  const state = useStoreSelector((state) => state)
  const { templates } = state.workflows
  const { namespaces } = state.experiments
  const dispatch = useStoreDispatch()
  const [workflowBasic, setWorkflowBasic] = useState<WorkflowBasic>({
    name: '',
    namespace: '',
    deadline: '',
  })
  const formikRef = useRef<any>(null)
  const [yamlEditor, setYAMLEditor] = useState<Ace.Editor>()

  useEffect(() => {
    if (!single || !formikRef.current) {
      return
    }
    const { name, namespace } = single
    formikRef.current.setFieldValue('name', name)
    formikRef.current.setFieldValue('namespace', namespace)
  }, [single])

  useEffect(() => {
    setYAMLEditor(externalEditor)
  }, [externalEditor])

  const submitWorkflow = () => {
    const workflow = yamlEditor?.getValue()

    if (process.env.NODE_ENV === 'development') {
      console.debug('Debug workflow:', workflow)
    }

    api.workflows
      .newWorkflow(yaml.load(workflow!))
      .then(() => {
        dispatch(resetWorkflow())

        navigate('/workflows')
      })
      .catch(console.error)
  }
  const onValidate = setWorkflowBasic

  return (
    <>
      <Formik
        initialValues={{ name: '', namespace: '', deadline: '' }}
        innerRef={formikRef}
        onSubmit={submitWorkflow}
        validate={onValidate}
        validateOnBlur={false}
      >
        {({ errors, touched }) => (
          <Form style={{ height: '100%' }}>
            <Space height="100%">
              <Typography>{T('newW.titleBasic')}</Typography>
              <TextField
                name="name"
                label={T('common.name')}
                validate={validateName(T('newW.nameValidation', intl))}
                helperText={errors.name && touched.name ? errors.name : T('newW.nameHelper')}
                error={errors.name && touched.name ? true : false}
              />
              <SelectField name="namespace" label={T('k8s.namespace')} helperText={T('newE.basic.namespaceHelper')}>
                {namespaces.map((n) => (
                  <MenuItem key={n} value={n}>
                    {n}
                  </MenuItem>
                ))}
              </SelectField>
              <TextField
                name="deadline"
                label={T('newW.node.deadline')}
                validate={validateDeadline(T('newW.node.deadlineValidation', intl))}
                helperText={errors.deadline && touched.deadline ? errors.deadline : T('newW.node.deadlineHelper')}
                error={errors.deadline && touched.deadline ? true : false}
              />
              {preview && (
                <Fragment>
                  <Typography>{T('common.preview')}</Typography>
                  <Box flex={1}>
                    <Paper sx={{ p: 0 }}>
                      <YAMLEditor
                        data={constructWorkflow(workflowBasic, Object.values(templates))}
                        mountEditor={setYAMLEditor}
                      />
                    </Paper>
                  </Box>
                </Fragment>
              )}
              <Button
                type="submit"
                variant="contained"
                color="primary"
                startIcon={<PublishIcon />}
                fullWidth
                disabled={!submitable && _isEmpty(templates)}
              >
                {T('newW.submit')}
              </Button>
            </Space>
          </Form>
        )}
      </Formik>
    </>
  )
}

export default MetaForm
