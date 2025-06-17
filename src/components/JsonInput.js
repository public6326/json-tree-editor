import React from "react";
import { Upload, message } from "antd";
import { InboxOutlined } from "@ant-design/icons";
import * as XLSX from "xlsx";

const { Dragger } = Upload;

// 创建一个新的JsonUpload组件，只保留上传功能，移除json输入区域
function JsonUpload({ onChange, onExcelParsed }) {
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
    <div className="json-upload">
      <h3>上传文件</h3>
      <div className="upload-area">
        <Dragger
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
                // 调用 onExcelParsed，保证 flatData/columns 有数据
                if (onExcelParsed && jsonData.length) {
                  const columns = Object.keys(jsonData[0]);
                  onExcelParsed(jsonData, columns);
                }
                message.success("Excel解析成功，已自动生成树结构");
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
        </Dragger>
      </div>
    </div>
  );
}

export default JsonUpload;
