import React, { useState } from "react";
import { Input, Button, Alert, Upload, message } from "antd";
import { UploadOutlined, InboxOutlined } from "@ant-design/icons";
import * as XLSX from "xlsx";

const { TextArea } = Input;
const { Dragger } = Upload;

function JsonInput({ onSubmit, onExcelParsed, value, onChange }) {
  const [error, setError] = useState("");

  const handleSubmit = () => {
    try {
      if (!value.trim()) {
        setError("请输入JSON数据");
        return;
      }

      const jsonData = JSON.parse(value);
      setError("");
      onSubmit(jsonData);
    } catch (err) {
      setError("JSON格式错误，请检查输入");
    }
  };

  const handleSampleData = () => {
    const sampleData = {
      key: "0",
      title: "根节点",
      children: [
        {
          key: "0-0",
          title: "子节点1",
          children: [
            { key: "0-0-0", title: "叶子节点1" },
            { key: "0-0-1", title: "叶子节点2" },
          ],
        },
        {
          key: "0-1",
          title: "子节点2",
          children: [{ key: "0-1-0", title: "叶子节点3" }],
        },
      ],
    };

    onChange(JSON.stringify(sampleData, null, 2));
  };

  // Excel 解析和树结构生成
  const handleExcel = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: "array" });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const json = XLSX.utils.sheet_to_json(worksheet, { defval: "" });
      if (!json.length) {
        message.error("Excel内容为空");
        return;
      }
      // 字段映射
      const idKey = "权限id";
      const parentIdKey = "父级权限id";
      const parentNameKey = "父级权限名称";
      const titleKey = "权限名称";
      // 1. 建立map
      const nodeMap = {};
      json.forEach((row) => {
        nodeMap[row[idKey]] = {
          ...row,
          key: row[idKey],
          title: row[titleKey],
          children: [],
        };
      });
      // 2. 组装树，先找所有根节点
      const allIds = new Set(json.map((row) => row[idKey]));
      let roots = json.filter((row) => {
        const pid = row[parentIdKey];
        return !pid || !allIds.has(pid);
      });
      // 3. 如果根节点多于1个，补充一个根节点
      let patchedJson = [...json];
      if (roots.length > 1) {
        // 检查是否已存在id=2的节点，避免重复
        const exist2 = patchedJson.find(
          (row) => row[idKey] === 2 || row[idKey] === "2"
        );
        if (!exist2) {
          // 新增根节点
          const rootNode = {
            [idKey]: 2,
            [titleKey]: "菜单权限",
            [parentIdKey]: 0,
            [parentNameKey]: "",
            key: 2,
            title: "菜单权限",
            children: [],
          };
          patchedJson.push(rootNode);
        }
        // 所有原根节点的父级id和父级名称都改为2和菜单权限
        patchedJson = patchedJson.map((row) => {
          const pid = row[parentIdKey];
          if (!pid || !allIds.has(pid)) {
            // 不是新加的根节点自身才改
            if (row[idKey] !== 2 && row[idKey] !== "2") {
              return {
                ...row,
                [parentIdKey]: 2,
                [parentNameKey]: "菜单权限",
              };
            }
          }
          return row;
        });
      }
      // 4. 重新生成 nodeMap
      const nodeMap2 = {};
      patchedJson.forEach((row) => {
        nodeMap2[row[idKey]] = {
          ...row,
          key: row[idKey],
          title: row[titleKey],
          children: [],
        };
      });
      // 5. 组装树
      const allIds2 = new Set(patchedJson.map((row) => row[idKey]));
      const tree = [];
      patchedJson.forEach((row) => {
        const parentId = row[parentIdKey];
        if (parentId && allIds2.has(parentId)) {
          nodeMap2[parentId].children.push(nodeMap2[row[idKey]]);
        } else {
          tree.push(nodeMap2[row[idKey]]);
        }
      });
      onChange(JSON.stringify(tree, null, 2));
      // 新增：将原始数据和表头传递给父组件
      if (onExcelParsed) {
        const columns = Object.keys(patchedJson[0]);
        onExcelParsed(patchedJson, columns);
      }
      message.success("Excel解析成功，已自动生成树结构");
    };
    reader.readAsArrayBuffer(file);
    return false; // 阻止Upload自动上传
  };

  // 将 Excel 数据转换为树结构
  const convertToTree = (data) => {
    const map = {};
    const roots = [];
    data.forEach((item) => {
      map[item["权限id"]] = {
        ...item,
        key: item["权限id"],
        title: item["权限名称"],
        children: [],
      };
    });
    data.forEach((item) => {
      const parentId = item["父级权限id"];
      if (parentId && map[parentId]) {
        map[parentId].children.push(map[item["权限id"]]);
      } else {
        roots.push(map[item["权限id"]]);
      }
    });

    // 如果根节点多于1个，添加统一根节点
    if (roots.length > 1) {
      // 检查是否已存在id=2的节点，避免重复
      const exist2 = data.find(
        (row) => row["权限id"] === 2 || row["权限id"] === "2"
      );
      if (!exist2) {
        // 新增根节点
        const rootNode = {
          权限id: 2,
          权限名称: "菜单权限",
          父级权限id: 0,
          父级权限名称: "",
          key: 2,
          title: "菜单权限",
          children: roots,
        };
        return [rootNode];
      }
    }
    return roots;
  };

  return (
    <div className="json-input">
      <h3>输入 JSON</h3>
      <div className="upload-area">
        <Upload.Dragger
          accept=".json,.xlsx,.xls"
          showUploadList={false}
          beforeUpload={(file) => {
            const isExcel =
              file.type ===
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
              file.type === "application/vnd.ms-excel";
            if (isExcel) {
              const reader = new FileReader();
              reader.onload = (e) => {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: "array" });
                const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                const jsonData = XLSX.utils.sheet_to_json(firstSheet, {
                  defval: "",
                });
                const treeData = convertToTree(jsonData);
                onChange(treeData);
                // 新增：调用 onExcelParsed，保证 flatData/columns 有数据
                if (onExcelParsed && jsonData.length) {
                  const columns = Object.keys(jsonData[0]);
                  onExcelParsed(jsonData, columns);
                }
              };
              reader.readAsArrayBuffer(file);
            } else {
              const reader = new FileReader();
              reader.onload = (e) => {
                try {
                  const jsonData = JSON.parse(e.target.result);
                  onChange(jsonData);
                } catch (error) {
                  message.error("无效的 JSON 文件");
                }
              };
              reader.readAsText(file);
            }
            return false;
          }}
        >
          <p className="ant-upload-drag-icon">
            <InboxOutlined />
          </p>
          <p className="ant-upload-text">点击或拖拽文件到此区域上传</p>
          <p className="ant-upload-hint">支持 .json 或 .xlsx 文件</p>
        </Upload.Dragger>
      </div>
      <TextArea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="请输入 JSON 数据"
        autoSize={{ minRows: 10, maxRows: 20 }}
      />
      {error && (
        <Alert message={error} type="error" style={{ margin: "10px 0" }} />
      )}
      <div style={{ marginTop: 16 }}>
        <Button
          type="primary"
          onClick={handleSubmit}
          style={{ marginRight: 8 }}
        >
          解析并显示
        </Button>
        <Button onClick={handleSampleData}>使用示例数据</Button>
      </div>
    </div>
  );
}

export default JsonInput;
