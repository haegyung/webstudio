import { computed } from "nanostores";
import { nanoid } from "nanoid";
import { useId, useMemo, useState } from "react";
import { useStore } from "@nanostores/react";
import type { DataSource, Resource } from "@webstudio-is/sdk";
import { encodeDataSourceVariable } from "@webstudio-is/react-sdk";
import {
  Box,
  Button,
  Flex,
  Grid,
  InputField,
  Label,
  Select,
  SmallIconButton,
  TextArea,
  theme,
} from "@webstudio-is/design-system";
import { DeleteIcon, PlusIcon } from "@webstudio-is/icons";
import { humanizeString } from "~/shared/string-utils";
import { serverSyncStore } from "~/shared/sync";
import {
  $dataSources,
  $resources,
  $selectedInstanceSelector,
  $variableValuesByInstanceSelector,
} from "~/shared/nano-states";
import {
  BindingPopover,
  evaluateExpressionWithinScope,
  isLiteralExpression,
} from "~/builder/shared/binding-popover";

const HeaderPair = ({
  editorAliases,
  editorScope,
  name,
  value,
  onChange,
  onDelete,
}: {
  editorAliases: Map<string, string>;
  editorScope: Record<string, unknown>;
  name: string;
  value: string;
  onChange: (name: string, value: string) => void;
  onDelete: () => void;
}) => {
  const nameId = useId();
  const valueId = useId();

  return (
    <Grid
      gap={2}
      align={"center"}
      css={{
        gridTemplateColumns: `${theme.spacing[18]} 1fr 19px`,
        gridTemplateAreas: `
         "name name-input button"
         "value  value-input  button"
        `,
      }}
    >
      <Label htmlFor={nameId} css={{ gridArea: "name" }}>
        Name
      </Label>
      <InputField
        css={{ gridArea: "name-input" }}
        id={nameId}
        value={name}
        onChange={(event) => {
          onChange(event.target.value, value);
        }}
      />
      <Label htmlFor={valueId} css={{ gridArea: "value" }}>
        Value
      </Label>
      <Box css={{ gridArea: "value-input", position: "relative" }}>
        <BindingPopover
          scope={editorScope}
          aliases={editorAliases}
          value={value}
          onChange={(newValue) => onChange(name, newValue)}
          onRemove={(evaluatedValue) =>
            onChange(name, JSON.stringify(evaluatedValue))
          }
        />
        <InputField
          id={valueId}
          // expressions with variables cannot be edited
          disabled={isLiteralExpression(value) === false}
          value={String(evaluateExpressionWithinScope(value, editorScope))}
          // update text value as string literal
          onChange={(event) =>
            onChange(name, JSON.stringify(event.target.value))
          }
        />
      </Box>

      <Grid
        css={{
          gridArea: "button",
          justifyItems: "center",
          gap: "2px",
          color: theme.colors.foregroundIconSecondary,
        }}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="19"
          height="11"
          viewBox="0 0 19 11"
          fill="currentColor"
        >
          <path d="M10 10.05V6.05005C10 2.73634 7.31371 0.0500488 4 0.0500488H0V1.05005H4C6.76142 1.05005 9 3.28863 9 6.05005V10.05H10Z" />
        </svg>
        <SmallIconButton
          variant="destructive"
          icon={<DeleteIcon />}
          onClick={onDelete}
        />
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="19"
          height="11"
          viewBox="0 0 19 11"
          fill="currentColor"
        >
          <path d="M-4.37114e-07 10.05L4 10.05C7.31371 10.05 10 7.36376 10 4.05005L10 0.0500488L9 0.0500488L9 4.05005C9 6.81147 6.76142 9.05005 4 9.05005L-3.93402e-07 9.05005L-4.37114e-07 10.05Z" />
        </svg>
      </Grid>
    </Grid>
  );
};

const Headers = ({
  editorScope,
  editorAliases,
  headers,
  onChange,
}: {
  editorAliases: Map<string, string>;
  editorScope: Record<string, unknown>;
  headers: Resource["headers"];
  onChange: (headers: Resource["headers"]) => void;
}) => {
  return (
    <Grid gap={3}>
      {headers.map((header, index) => (
        <HeaderPair
          key={index}
          editorScope={editorScope}
          editorAliases={editorAliases}
          name={header.name}
          value={header.value}
          onChange={(name, value) => {
            const newHeaders = [...headers];
            newHeaders[index] = { name, value };
            onChange(newHeaders);
          }}
          onDelete={() => {
            const newHeaders = [...headers];
            newHeaders.splice(index, 1);
            onChange(newHeaders);
          }}
        />
      ))}
      <Button
        type="button"
        color="neutral"
        css={{ justifySelf: "center" }}
        prefix={<PlusIcon />}
        onClick={() => {
          // use empty string expression as default
          const newHeaders = [...headers, { name: "", value: `""` }];
          onChange(newHeaders);
        }}
      >
        Add another header pair
      </Button>
    </Grid>
  );
};

const $selectedInstanceScope = computed(
  [$selectedInstanceSelector, $variableValuesByInstanceSelector, $dataSources],
  (instanceSelector, variableValuesByInstanceSelector, dataSources) => {
    const scope: Record<string, unknown> = {};
    const aliases = new Map<string, string>();
    if (instanceSelector === undefined) {
      return { scope, aliases };
    }
    const values = variableValuesByInstanceSelector.get(
      JSON.stringify(instanceSelector)
    );
    if (values) {
      for (const [dataSourceId, value] of values) {
        const dataSource = dataSources.get(dataSourceId);
        // prevent resources using data of other resources
        if (dataSource === undefined || dataSource.type === "resource") {
          continue;
        }
        const name = encodeDataSourceVariable(dataSourceId);
        scope[name] = value;
        aliases.set(name, dataSource.name);
      }
    }
    return { scope, aliases };
  }
);

export const ResourcePanel = ({
  variable,
  onClose,
}: {
  variable?: DataSource;
  onClose: () => void;
}) => {
  const resources = useStore($resources);
  const resource =
    variable?.type === "resource"
      ? resources.get(variable.resourceId)
      : undefined;

  const nameId = useId();
  const [name, setName] = useState(variable?.name ?? "");
  const urlId = useId();
  // empty string as default
  const [url, setUrl] = useState(resource?.url ?? `""`);
  const [method, setMethod] = useState<Resource["method"]>(
    resource?.method ?? "get"
  );
  const [headers, setHeaders] = useState<Resource["headers"]>(
    resource?.headers ?? []
  );
  // empty string as default
  const [body, setBody] = useState(resource?.body ?? `""`);

  const { scope: scopeWithCurrentVariable, aliases } = useStore(
    $selectedInstanceScope
  );
  const currentVariableId = variable?.id;
  // prevent showing currently edited variable in suggestions
  // to avoid cirular dependeny
  const scope = useMemo(() => {
    if (currentVariableId === undefined) {
      return scopeWithCurrentVariable;
    }
    const newScope: Record<string, unknown> = { ...scopeWithCurrentVariable };
    delete newScope[encodeDataSourceVariable(currentVariableId)];
    return newScope;
  }, [scopeWithCurrentVariable, currentVariableId]);

  return (
    <Flex
      direction="column"
      css={{
        overflow: "hidden",
        gap: theme.spacing[9],
        px: theme.spacing[9],
        pb: theme.spacing[9],
      }}
    >
      <Flex direction="column" css={{ gap: theme.spacing[3] }}>
        <Label htmlFor={nameId}>Name</Label>
        <InputField
          id={nameId}
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </Flex>
      <Flex direction="column" css={{ gap: theme.spacing[3] }}>
        <Label htmlFor={urlId}>URL</Label>
        <Box css={{ position: "relative" }}>
          <BindingPopover
            scope={scope}
            aliases={aliases}
            value={url}
            onChange={setUrl}
            onRemove={(evaluatedValue) =>
              setUrl(JSON.stringify(evaluatedValue))
            }
          />
          <InputField
            id={urlId}
            // expressions with variables cannot be edited
            disabled={isLiteralExpression(url) === false}
            value={String(evaluateExpressionWithinScope(url, scope))}
            // update text value as string literal
            onChange={(event) => setUrl(JSON.stringify(event.target.value))}
          />
        </Box>
      </Flex>
      <Flex direction="column" css={{ gap: theme.spacing[3] }}>
        <Label>Method</Label>
        <Select<Resource["method"]>
          options={["get", "post", "put", "delete"]}
          getLabel={humanizeString}
          value={method}
          onChange={(newValue) => setMethod(newValue)}
        />
      </Flex>
      <Flex direction="column" css={{ gap: theme.spacing[3] }}>
        <Label>Headers</Label>
        <Headers
          editorScope={scope}
          editorAliases={aliases}
          headers={headers}
          onChange={setHeaders}
        />
      </Flex>
      {method !== "get" && (
        <Flex direction="column" css={{ gap: theme.spacing[3] }}>
          <Label>Body</Label>
          <Box css={{ position: "relative" }}>
            <BindingPopover
              scope={scope}
              aliases={aliases}
              value={body}
              onChange={setBody}
              onRemove={(evaluatedValue) =>
                setBody(JSON.stringify(evaluatedValue))
              }
            />
            <TextArea
              autoGrow={true}
              maxRows={10}
              // expressions with variables cannot be edited
              disabled={isLiteralExpression(body) === false}
              value={String(evaluateExpressionWithinScope(body, scope))}
              // update text value as string literal
              onChange={(newValue) => setBody(JSON.stringify(newValue))}
            />
          </Box>
        </Flex>
      )}

      <Flex justify="end" css={{ gap: theme.spacing[5] }}>
        <Button color="neutral" onClick={onClose}>
          Cancel
        </Button>
        <Button
          onClick={() => {
            const instanceSelector = $selectedInstanceSelector.get();
            if (instanceSelector === undefined) {
              return;
            }
            const [instanceId] = instanceSelector;
            const newResource: Resource = {
              id: resource?.id ?? nanoid(),
              name,
              url,
              method,
              headers,
              body,
            };
            const newVariable: DataSource = {
              id: variable?.id ?? nanoid(),
              // preserve existing instance scope when edit
              scopeInstanceId: variable?.scopeInstanceId ?? instanceId,
              name,
              type: "resource",
              resourceId: newResource.id,
            };
            serverSyncStore.createTransaction(
              [$dataSources, $resources],
              (dataSources, resources) => {
                dataSources.set(newVariable.id, newVariable);
                resources.set(newResource.id, newResource);
              }
            );
            onClose();
          }}
        >
          Save
        </Button>
      </Flex>
    </Flex>
  );
};