/* tslint:disable:no-console */
import * as handlebars from 'handlebars';
import * as request from 'superagent';
import * as Swagger from './swagger';
import { fsReadFile, fsWriteFile } from './fs';

interface ITemplateView {
  services: ITemplateService[];
  models: ITemplateModel[];
  baseUrl: string;
  apiPath: string;
}

interface ITemplateService {
  name: string;
  operations: ITemplateOperation[];
}

interface ITemplateModel {
  name: string;
  description?: string;
  properties: Array<{
    propertyName: string;
    propertyType: string;
    description?: string;
  }>;
}

interface ITemplateOperation {
  id: string;
  method: string;
  signature: string;
  urlTemplate: string;
  returnType: string;
  paramsInterfaceName?: string;
  parameters?: ITemplateOperationParameters[];
  queryParameters?: string[];
  bodyParameter?: string;
  hasParameters: boolean;
  hasBodyParameter: boolean;
  description?: string;
}

interface ITemplateOperationParameters {
  parameterName: string;
  parameterType: string;
  description?: string;
}

process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = 0 as any;

const template = (namespace: string) => handlebars.compile(`/* tslint:disable */
/**
 * This is generated by swagger-ts-client-gen - do not edit directly!
 */
import request from 'superagent';

export interface IRequestParams {
  originalParams?: any;
  method: string;
  url: string;
  queryParameters?: { [key: string]: string | boolean | number | Date | undefined };
  body?: {[key: string]: any};
}

type ReqModifier = (req: request.SuperAgentRequest) => void;

let baseApiUrl: string = (process.env.API_PROTOCOL || 'https') + "://" + process.env.API_HOST;
let requestModFn: ReqModifier | undefined;

export const updateAPIEndpoint = (params: { host: string; protocol?: string; }) => {
  baseApiUrl = \`\${params.protocol || 'https'}://\${params.host}\`;
};

export const setRequestModifier = (fn: (req: request.SuperAgentRequest) => void) => {
    requestModFn = fn;
};

export type TRequestExecReturn<T = any> = {
  promise: Promise<request.Response & { body: T }>;
  request: request.SuperAgentRequest;
  params: IRequestParams;
};

function executeRequest<T = any>(params: IRequestParams, _requestModFn?: ReqModifier): TRequestExecReturn<T> {
  let req = request(params.method, params.url).set('Content-Type', 'application/json');

  if (requestModFn) {
    requestModFn(req);
  }

  if (_requestModFn) {
    _requestModFn(req);
  }

  const queryParameters = params.queryParameters;

  if (queryParameters) {
    Object.keys(queryParameters).forEach(key => {
      const value = queryParameters[key];
      if (Object.prototype.toString.call(value) === '[object Date]') {
        queryParameters[key] = (value as Date).toISOString();
      }
    });

    req = req.query(queryParameters);
  }
  
  if (params.body) {
    const keys = Object.keys(params.body);
    let hasFiles = false;

    keys.forEach(k => {
      const value = params.body ? params.body[k] : undefined;
      const isFile = value instanceof File;
      hasFiles = hasFiles || isFile;

      if (value === undefined) return;

      if (isFile) {
        req.attach(k, value);
      } else {
        req.field(k, value);
      }
    });

    if (hasFiles) {
      req.unset('Content-Type');
    } else {
      req.send(params.body);
    }
  }
  
  const promise = new Promise<request.Response & { body: T }>((resolve, reject) => {
    req.end((error: any, response: request.Response) => {
      if (error || !response.ok) {
        if (response) {
          reject(response);
        } else {
          reject(error);
        }
      } else {
        resolve(response);
      }
    });
  });

  return { promise, request: req, params };
}

{{#models}}

{{#if description}}
/**
* {{description}}
*/
{{/if}}

export interface {{name}} {
{{#properties}}
{{#if description}}
/**
 * {{description}}
 */
{{/if}}
{{propertyName}}: {{propertyType}};
{{/properties}}
}
{{/models}}

{{#services}}
{{#operations}}
{{#if hasParameters}}

export interface {{paramsInterfaceName}} {
{{#parameters}}
{{#if description}}
/**
 * {{description}}
 */
{{/if}}
{{parameterName}}: {{parameterType}};
{{/parameters}}
}
{{/if}}
{{/operations}}
{{/services}}
{{#services}}

export const {{name}} = {
{{#operations}}

{{#if description}}
/**
 * {{description}}
 */
{{/if}}

{{#if signature}}
  {{id}}: function({{signature}}, requestModFn?: ReqModifier) {
  {{else}}
  {{id}}: function(requestModFn?: ReqModifier) {
{{/if}}

  const requestParams: IRequestParams = {
    {{#if signature}}
    originalParams: _params,
    {{/if}}
    method: '{{method}}',
    url: \`\${baseApiUrl}{{../../apiPath}}{{urlTemplate}}\`
  };
  {{#if queryParameters}}

  requestParams.queryParameters = {
  {{#queryParameters}}
    {{this}}: _params.{{this}},
  {{/queryParameters}}
  };
  {{/if}}
  {{#if hasBodyParameter}}

  requestParams.body = _params.{{bodyParameter}};
  {{/if}}
  return executeRequest<{{returnType}}>(requestParams, requestModFn);
},
{{/operations}}
}
{{/services}}

`);

const stringifyNumberEnum = (enumValue: Array<any>) => enumValue.map(s => `${s}`).join(' | ');
const getTypeFromRef = ($ref: string) => {
  return `${$ref.replace('#/definitions/', '')}`;
};

const getPropertyTypeFromSwaggerProperty = (property: Swagger.ISchema): string => {
  if (!property) { return 'void'; }

  if (property.type) {
    if (property.type === 'integer' || property.format === 'double') {
      if (property.format === 'int64') { return 'string'; }
      if (property.enum) { return stringifyNumberEnum(property.enum); }

      return 'number';
    }
    if (property.type === 'boolean') { return 'boolean'; }
    if (property.type === 'string') {
      return property.format === 'date-time' ? 'Date' : 'string';
    }

    if (property.type === 'array') {
      const items = property.items as Swagger.ISchema;
      if (!items) { throw new Error(); }

      if (items.type) {
        return `any[]`;
      }

      return `${getTypeFromRef(items.$ref as string)}[]`;
    }
  }

  if (property.$ref) { return getTypeFromRef(property.$ref); }

  return 'any';
};

const getTypeScriptTypeFromSwaggerType = (schema: Swagger.ISchema) => {
  if (schema.type === 'integer' || schema.type === 'number') {
    if (schema.enum) {
      return stringifyNumberEnum(schema.enum);
    }

    return 'number';
  }

  if (schema.type === 'boolean') { return 'boolean'; }
  if (schema.type === 'string') {
    return schema.format === 'date-time' ? 'Date' : 'string';
  }

  return undefined;
};

const getPropertyTypeFromSwaggerParameter = (parameter: Swagger.IBaseParameter): string => {
  const queryParameter = parameter as Swagger.IQueryParameter;
  if (queryParameter.type) {
    const tsType = getTypeScriptTypeFromSwaggerType(queryParameter as any);
    if (tsType) { return tsType; }
  }

  const bodyParameter = parameter as Swagger.IBodyParameter;
  const schema = bodyParameter.schema;
  if (schema) {
    if (schema.$ref) {
      return getTypeFromRef(schema.$ref);
    }

    if (schema.type === 'array') {
      const items = schema.items as Swagger.ISchema;
      if (items.$ref) { return `${getTypeFromRef(items.$ref as string)}[]`; }
      if (items.type) {
        const tsType = getTypeScriptTypeFromSwaggerType(items);
        if (tsType) { return `${tsType}[]`; }
      }
    }
  }

  return 'any';
};

const getNormalizedDefinitionKey = (key: string) => {
  if (key.includes('[]')) {
    return key;
  }

  return key.replace('[', '').replace(']', '');
};

const getTemplateView = (swagger: Swagger.ISpec, baseUrl: string): ITemplateView => {
  const definitions = swagger.definitions;
  if (!definitions) { throw new Error('No definitions.'); }

  const paths = swagger.paths;
  if (!paths) { throw new Error('No paths.'); }

  const serviceMap: { [serviceName: string]: ITemplateService } = {};
  Object.keys(paths)
    .forEach(pathKey => {
      const methods = ['get', 'post', 'delete', 'patch', 'put', 'options', 'head'];
      const path = paths[pathKey];

      Object.keys(path)
        .filter(operationKey => methods.find(m => m === operationKey))
        .forEach(operationKey => {
          const operation = (path as any)[operationKey] as Swagger.IOperation;
          if (!operation.operationId || !operation.tags) { throw new Error('no tags for ' + JSON.stringify(path)); }

          const tag = operation.tags[0];
          const service = serviceMap[tag] = serviceMap[tag] || { name: `${tag}Service`, operations: [] };

          let operationId = operation.operationId.replace('_', '');
          if (tag) {
            operationId = operationId.replace(tag, '');
          }

          const parameters = operation.parameters;
          const operationParameters = new Array<ITemplateOperationParameters>();

          // /api/{someParam}/{anotherParam} => /api/${someParam}/${anotherParam}
          let urlTemplate = `${pathKey}`.replace(/\{/g, '${');
          let signature = '';
          let paramsInterfaceName = '';
          let queryParameters: string[] | undefined = undefined;
          let bodyParameter: string | undefined;
          let hasBodyParameter = false;

          if (parameters && parameters.length) {
            paramsInterfaceName = `I${tag}${operationId.charAt(0).toUpperCase() + operationId.slice(1)}Params`;
            signature = `_params: ${paramsInterfaceName}`;
            parameters.forEach(parameter => {
              const parameterName = parameter.name;

              operationParameters.push({
                parameterName: `${parameterName}${parameter.required === false ? '?' : ''}`,
                parameterType: getPropertyTypeFromSwaggerParameter(parameter),
                description: parameter.description
              });

              if (parameter.in === 'path') {
                urlTemplate = urlTemplate.replace(parameter.name, `_params.${parameterName}`);
                return;
              }

              if (parameter.in === 'query') {
                queryParameters = queryParameters || new Array<string>();
                queryParameters.push(parameterName);
                return;
              }

              if (parameter.in === 'body') {
                hasBodyParameter = true;
                bodyParameter = parameterName;
              }
            });
          }

          let returnType = 'void';
          if (operation.responses['200']) {
            returnType = getNormalizedDefinitionKey(getPropertyTypeFromSwaggerProperty(operation.responses['200'].schema as Swagger.ISchema));
          }

          service.operations.push({
            id: operationId.charAt(0).toLowerCase() + operationId.slice(1),
            method: operationKey.toUpperCase(),
            signature,
            urlTemplate,
            parameters: operationParameters,
            hasParameters: !!operationParameters.length,
            bodyParameter,
            queryParameters,
            returnType,
            paramsInterfaceName,
            hasBodyParameter,
            description: operation.description
          } as ITemplateOperation);
        });
    });

  return {
    baseUrl,
    apiPath: swagger.basePath as string,
    services: Object.keys(serviceMap).map(key => serviceMap[key]),
    models: Object.keys(definitions).map(definitionKey => {
      const definition = definitions[definitionKey];
      if (!definition) { throw new Error('No definition found.'); }

      const properties = definition.properties;
      if (!properties) {
        console.log(definition);
        throw new Error('No definition properties found.');
      }

      return {
        name: `${getNormalizedDefinitionKey(definitionKey)}`,
        description: definition.description,
        properties: Object.keys(properties).map(propertyKey => {
          const property = properties[propertyKey];
          const isRequired = definition.required && definition.required.find(propertyName => propertyName === propertyKey);

          return {
            propertyName: `${propertyKey}${isRequired ? '' : '?'}`,
            propertyType: getPropertyTypeFromSwaggerProperty(property),
            description: property.description
          };
        })
      };
    })
  };
};

const specFetch = {
  url: async (url: string) => {
    return new Promise<Swagger.ISpec>((resolve, reject) => {
      request
        .get(url)
        .set('Accept', 'application/json')
        .end((err, res) => {
          if (err) { return reject(err); }
          resolve(res.body);
        });
    });
  },
  file: async (path: string) => {
    const raw = await fsReadFile(path);
    return JSON.parse(raw.toString('utf8')) as Swagger.ISpec;
  }
};

export interface IGenerateParams {
  type: 'url' | 'file';
  srcPath: string;
  destPath: string;
  namespace: string;
  baseUrl?: string;
  spec?: Swagger.ISpec;
}

export const generate = async ({ type, srcPath, destPath, baseUrl, namespace, spec }: IGenerateParams) => {
  if (!spec) {
    const fetcher = specFetch[type];
    if (!fetcher) {
      throw new Error(`unknown source type: ${type}`);
    }

    spec = await fetcher(srcPath);
  }

  try {
    const compiled = template(namespace)(getTemplateView(spec, baseUrl || spec.host || ''));
    await fsWriteFile(destPath, compiled);

  } catch (err) {
    console.log(err);
  }
};
