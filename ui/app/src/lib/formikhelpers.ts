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

import { Experiment, ExperimentKind, Frame, Scope } from 'components/NewExperiment/types'
import { sanitize, toTitleCase } from './utils'

import { Env } from 'slices/experiments'
import { ScheduleSpecific } from 'components/Schedule/types'
import { Template } from 'slices/workflows'
import { WorkflowBasic } from 'components/NewWorkflow/MetaForm'
import basicData from 'components/NewExperimentNext/data/basic'
import { templateTypeToFieldName } from 'api/zz_generated.frontend.chaos-mesh'
import yaml from 'js-yaml'

export function parseSubmit<K extends ExperimentKind>(
  env: Env,
  _kind: K,
  e: Experiment<Exclude<K, 'Schedule'>>,
  options?: {
    inSchedule?: boolean
  }
) {
  const kind = env === 'k8s' ? _kind : 'PhysicalMachineChaos'
  const values: typeof e = JSON.parse(JSON.stringify(e))
  let { metadata, spec } = values

  // Set default namespace when it's not present
  if (!metadata.namespace) {
    metadata.namespace = env === 'k8s' ? spec.selector.namespaces[0] : 'default'
  }

  // Parse labels, annotations, labelSelectors, and annotationSelectors to object
  function helper1(selectors: string[], updateVal?: (s: string) => any) {
    return selectors.reduce((acc: Record<string, any>, d) => {
      const splited = d.replace(/\s/g, '').split(/:(.+)/)

      acc[splited[0]] = typeof updateVal === 'function' ? updateVal(splited[1]) : splited[1]

      return acc
    }, {})
  }

  // Parse http headers to object
  function helperHTTPHeaders(selectors: string[]) {
    return selectors.reduce((acc: Record<string, any>, d) => {
      const splited = d.split(/:(.+)/)
      acc[splited[0].trim()] = splited[1].trim()
      return acc
    }, {})
  }

  // Parse http queries to patch object
  function helperHTTPPatchQueries(selectors: string[]) {
    return selectors.map((d) => {
      return d
        .replace(/\s/g, '')
        .split(/:(.+)/)
        .slice(0, 2)
        .map((s) => s.trim())
    })
  }

  // Parse http headers to patch object
  function helperHTTPPatchHeaders(selectors: string[]) {
    return selectors.map((d) => {
      return d
        .split(/:(.+)/)
        .slice(0, 2)
        .map((s) => s.trim())
    })
  }

  // Parse selector
  function helper2(scope: Scope['selector']) {
    if (scope.labelSelectors?.length) {
      scope.labelSelectors = helper1(scope.labelSelectors) as any
    } else {
      delete scope.labelSelectors
    }
    if (scope.annotationSelectors?.length) {
      scope.annotationSelectors = helper1(scope.annotationSelectors) as any
    } else {
      delete scope.annotationSelectors
    }

    // Parse podPhaseSelectors
    const podPhaseSelectors = scope.podPhaseSelectors
    if (podPhaseSelectors?.length === 1 && podPhaseSelectors[0] === 'all') {
      delete scope.podPhaseSelectors
    }

    // Parse pods
    if (scope.pods?.length) {
      scope.pods = scope.pods.reduce((acc, d) => {
        const [namespace, name] = d.split(':')
        if (acc.hasOwnProperty(namespace)) {
          acc[namespace].push(name)
        } else {
          acc[namespace] = [name]
        }

        return acc
      }, {} as Record<string, string[]>) as any
    } else {
      delete scope.pods
    }
  }

  if (metadata.labels?.length) {
    metadata.labels = helper1(metadata.labels) as any
  } else {
    delete metadata.labels
  }
  if (metadata.annotations?.length) {
    metadata.annotations = helper1(metadata.annotations) as any
  } else {
    delete metadata.annotations
  }

  if (env === 'k8s') {
    helper2(spec.selector)

    delete (spec as any).address // remove the address field only used in PhysicalMachineChaos
  }

  if (env === 'k8s' && kind === 'NetworkChaos') {
    if (!(spec as any).externalTargets.length) {
      delete (spec as any).externalTargets
    }

    if ((spec as any).target) {
      if ((spec as any).target.mode) {
        helper2((spec as any).target.selector)
      } else {
        ;(spec as any).target = undefined
      }
    }
  }

  if (kind === 'IOChaos' && (spec as any).action === 'attrOverride') {
    ;(spec as any).attr = helper1((spec as any).attr as string[], (s: string) => parseInt(s, 10))
  }

  if (kind === 'HTTPChaos') {
    ;(spec as any).request_headers = helperHTTPHeaders((spec as any).request_headers as string[])
    if ((spec as any).response_headers) {
      ;(spec as any).response_headers = helperHTTPHeaders((spec as any).response_headers as string[])
    }
    if ((spec as any).replace && (spec as any).replace.headers) {
      ;(spec as any).replace.headers = helperHTTPHeaders((spec as any).replace.headers as string[])
    }
    if ((spec as any).replace && (spec as any).replace.queries) {
      ;(spec as any).replace.queries = helper1((spec as any).replace.queries as string[])
    }
    if ((spec as any).patch && (spec as any).patch.headers) {
      ;(spec as any).patch.headers = helperHTTPPatchHeaders((spec as any).patch.headers as string[])
    }
    if ((spec as any).patch && (spec as any).patch.queries) {
      ;(spec as any).patch.queries = helperHTTPPatchQueries((spec as any).patch.queries as string[])
    }
  }

  function parsePhysicalMachineChaos(spec: any) {
    delete spec.selector
    delete spec.mode

    const { action, address, duration } = spec as any

    delete spec.action
    delete spec.address
    delete spec.duration

    return {
      address,
      action,
      [action]: spec,
      duration,
    }
  }

  if (options?.inSchedule) {
    const { schedule, historyLimit, concurrencyPolicy, startingDeadlineSeconds, ...rest } =
      spec as unknown as ScheduleSpecific
    const scheduleSpec = {
      schedule,
      historyLimit,
      concurrencyPolicy,
      startingDeadlineSeconds,
      type: kind,
      [templateTypeToFieldName(kind)]: kind === 'PhysicalMachineChaos' ? parsePhysicalMachineChaos(rest) : rest,
    }
    spec = scheduleSpec as any
  }

  if (!options?.inSchedule && kind === 'PhysicalMachineChaos') {
    spec = parsePhysicalMachineChaos(spec) as any
  }

  return sanitize({
    apiVersion: 'chaos-mesh.org/v1alpha1',
    kind: options?.inSchedule ? 'Schedule' : kind,
    metadata,
    spec,
  })
}

function podSelectorsToArr(selector: Object) {
  return Object.entries(selector)
    .map(([ns, pods]) => pods.map((p: string) => `${ns}: ${p}`))
    .flat()
}

function selectorsToArr(selectors: Object, separator: string) {
  return Object.entries(selectors).map(([key, val]) => `${key}${separator}${val}`)
}

export function parseYAML(yamlObj: any): { kind: ExperimentKind; basic: any; spec: any } {
  let { kind, metadata, spec }: { kind: ExperimentKind; metadata: any; spec: any } = yamlObj

  if (!kind || !metadata || !spec) {
    throw new Error('Fail to parse the YAML file. Please check the kind, metadata, and spec fields.')
  }

  const isSchedule = (kind as any) === 'Schedule'

  if (!isSchedule && kind !== 'PhysicalMachineChaos' && !spec.selector) {
    throw new Error('The required spec.selector field is missing.')
  }

  let basic = {
    metadata: {
      ...metadata,
      labels: metadata.labels ? selectorsToArr(metadata.labels, ':') : [],
      annotations: metadata.annotations ? selectorsToArr(metadata.annotations, ':') : [],
    },
    spec: {},
  }

  function parseBasicSpec(kind: ExperimentKind, spec: typeof basicData.spec) {
    return {
      selector: {
        ...basicData.spec.selector,
        ...(kind !== 'PhysicalMachineChaos'
          ? {
              namespaces: spec.selector.namespaces ?? [],
              labelSelectors: spec.selector.labelSelectors ? selectorsToArr(spec.selector.labelSelectors, ': ') : [],
              annotation_selectors: spec.selector.annotationSelectors
                ? selectorsToArr(spec.selector.annotationSelectors, ': ')
                : [],
            }
          : undefined),
      },

      mode: spec.mode ?? 'one',
      value: spec.value,
      address: spec.address ?? [],
      duration: spec.duration ?? '',
    }
  }

  if (isSchedule) {
    const { schedule, historyLimit, concurrencyPolicy, startingDeadlineSeconds, ...rest } =
      spec as unknown as ScheduleSpecific
    const scheduleSpec = {
      schedule,
      historyLimit,
      concurrencyPolicy,
      startingDeadlineSeconds,
    }
    kind = (rest as any).type
    spec = (rest as any)[templateTypeToFieldName(kind)]
    basic.spec = { ...parseBasicSpec(kind, spec), ...scheduleSpec }
  } else {
    basic.spec = parseBasicSpec(kind, spec)
  }

  if (kind === 'NetworkChaos') {
    if (spec.target) {
      spec.target.selector.labelSelectors = spec.target.selector.labelSelectors
        ? selectorsToArr(spec.target.selector.labelSelectors, ': ')
        : []
      spec.target.selector.annotationSelectors = spec.target.selector.annotationSelectors
        ? selectorsToArr(spec.target.selector.annotationSelectors, ': ')
        : []
      spec.target.selector.podPhaseSelectors = spec.target.selector.podPhaseSelectors || []
      spec.target.selector.pods = spec.target.selector.pods ? podSelectorsToArr(spec.target.selector.pods) : []
    }
  }

  if (kind === 'IOChaos' && spec.attr) {
    spec.attr = selectorsToArr(spec.attr, ':')
  }

  if (kind === 'KernelChaos' && spec.failKernRequest) {
    spec.failKernRequest.callchain = spec.failKernRequest.callchain.map((frame: Frame) => {
      if (!frame.parameters) {
        frame.parameters = ''
      }

      if (!frame.predicate) {
        frame.predicate = ''
      }

      return frame
    })
  }

  if (kind === 'StressChaos') {
    spec.stressors.cpu = {
      workers: 0,
      load: 0,
      options: [],
      ...spec.stressors.cpu,
    }

    spec.stressors.memory = {
      workers: 0,
      options: [],
      ...spec.stressors.memory,
    }
  }

  if (kind === 'PhysicalMachineChaos') {
    const action: string = spec.action

    spec = {
      action,
      ...spec[action],
    }

    if (action.startsWith('disk')) {
      kind = 'DiskChaos' as any
    }

    if (action.startsWith('jvm')) {
      kind = 'JVMChaos'
    }

    if (action.startsWith('network')) {
      kind = 'NetworkChaos'
    }

    if (action.startsWith('process')) {
      kind = 'ProcessChaos' as any
    }

    if (action.startsWith('stress')) {
      kind = 'StressChaos'
    }

    if (action === 'clock') {
      kind = 'TimeChaos'
    }
  } else {
    const { selector, mode, value, duration, ...rest } = spec
    spec = rest
  }

  return sanitize({
    kind,
    basic,
    spec,
  })
}

function validate(defaultI18n: string, i18n?: string) {
  return function (value: string) {
    let error

    if (value === '') {
      error = i18n ?? defaultI18n
    }

    return error
  }
}
export const validateName = (i18n?: string) => validate('The name is required', i18n)
export const validateDuration = (i18n?: string) => validate('The duration is required', i18n)
export const validateSchedule = (i18n?: string) => validate('The schedule is required', i18n)
export const validateDeadline = (i18n?: string) => validate('The deadline is required', i18n)
export const validateImage = (i18n?: string) => validate('The image is required', i18n)

export function constructWorkflow(basic: WorkflowBasic, templates: Template[]) {
  const { name, namespace, deadline } = basic
  const children: string[] = templates.map((d) => d.name)
  const realTemplates: Record<string, any>[] = []

  function pushTemplate(template: any) {
    if (!realTemplates.some((t) => t.name === template.name)) {
      realTemplates.push(template)
    }
  }

  function pushSingle(template: Template) {
    const exp = template.experiment
    const kind = exp.kind
    const { duration: deadline, ...rest } = exp.spec

    pushTemplate({
      name: template.name,
      templateType: kind,
      deadline,
      [templateTypeToFieldName(kind)]: rest,
    })
  }

  function recurInsertTemplates(templates: Template[]) {
    templates.forEach((t) => {
      switch (t.type) {
        case 'single':
          pushSingle(t)

          break
        case 'serial':
        case 'parallel':
        case 'custom':
          t.children!.forEach((d) => {
            if (d.children) {
              pushTemplate({
                name: d.name,
                templateType: toTitleCase(d.type),
                deadline: d.deadline,
                children: d.children!.map((dd) => dd.name),
              })

              recurInsertTemplates(d.children)
            } else {
              if (d.type === 'suspend') {
                pushTemplate({
                  name: d.name,
                  templateType: 'Suspend',
                  deadline: d.deadline,
                })

                return
              }

              pushSingle(d)
            }
          })

          pushTemplate({
            name: t.name,
            templateType: toTitleCase(t.type === 'custom' ? 'task' : t.type),
            deadline: t.type !== 'custom' ? t.deadline : undefined,
            children: t.type !== 'custom' ? t.children!.map((d) => d.name) : undefined,
            task:
              t.type === 'custom'
                ? {
                    container: t.custom?.container,
                  }
                : undefined,
            conditionalBranches: t.type === 'custom' ? t.custom?.conditionalBranches : undefined,
          })

          break
        case 'suspend':
          pushTemplate({
            name: t.name,
            templateType: 'Suspend',
            deadline: t.deadline,
          })

          break
        default:
          break
      }
    })
  }

  recurInsertTemplates(templates)

  return yaml.dump(
    {
      apiVersion: 'chaos-mesh.org/v1alpha1',
      kind: 'Workflow',
      metadata: {
        name,
        namespace,
      },
      spec: {
        entry: 'entry',
        templates: [
          {
            name: 'entry',
            templateType: 'Serial',
            deadline,
            children,
          },
          ...realTemplates,
        ],
      },
    },
    {
      replacer: (_, value) => {
        if (Array.isArray(value)) {
          return value.length ? value : undefined
        }

        switch (typeof value) {
          case 'string':
            return value !== '' ? value : undefined
          default:
            return value
        }
      },
    }
  )
}
